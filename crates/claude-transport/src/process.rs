//! A Claude Code process, and the two pipes it speaks over.
//!
//! Started with `--input-format stream-json --output-format stream-json`,
//! it takes a JSON object a line on stdin and writes one a line on stdout.
//!
//! Three things this has to get right on Windows:
//!
//! * The process tree. The CLI starts MCP servers and shells of its own;
//!   killing it alone leaves them running. They go in a Job Object.
//! * The text. Its own errors may be in the console's codepage, so stderr
//!   is read lossily rather than dropping what says why it failed.
//! * The console window. A GUI app starting a console program shows a
//!   black window unless the process is created with `CREATE_NO_WINDOW`.

use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;

use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, Mutex};

use crate::control::{self, Pending, Timeouts};
use crate::frame::{Frame, LineDecoder};

/// What to start, and where.
#[derive(Debug, Clone)]
pub struct Launch {
    pub executable: std::path::PathBuf,
    pub args: Vec<String>,
    pub cwd: std::path::PathBuf,
    /// The whole environment, not a patch: the CLI must not inherit the
    /// app's own `ANTHROPIC_*` by accident.
    pub env: Vec<(String, String)>,
}

/// What the process says.
#[derive(Debug)]
pub enum Event {
    /// One frame, whole.
    Frame(Frame),
    /// Its stderr, a line: what it says before it dies, and its progress.
    Stderr(String),
    /// It is gone.
    Exited { code: Option<i32>, stderr: String },
}

/// A running session's process.
pub struct Process {
    child: Child,
    stdin: mpsc::Sender<String>,
    pending: Arc<Pending>,
    timeouts: Timeouts,
    /// Keeps the process tree alive as a unit on Windows.
    #[cfg(windows)]
    _job: JobHandle,
}

impl Process {
    /// Starts [launch], and a task reading its stdout.
    pub async fn start(
        launch: Launch,
        events: mpsc::Sender<Event>,
    ) -> Result<Self, std::io::Error> {
        let mut command = Command::new(&launch.executable);
        command
            .args(&launch.args)
            .current_dir(&launch.cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env_clear()
            .envs(launch.env.iter().map(|(name, value)| (name, value)))
            .kill_on_drop(true);

        #[cfg(windows)]
        {
            // No console window, and a process group of its own to kill.
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = command.spawn()?;

        #[cfg(windows)]
        let job = JobHandle::assign(&child)?;

        let stdin = child.stdin.take().expect("piped");
        let stdout = child.stdout.take().expect("piped");
        let stderr = child.stderr.take().expect("piped");

        let (writer, lines) = mpsc::channel::<String>(1024);
        tokio::spawn(write_stdin(stdin, lines));

        let pending = Arc::new(Pending::default());
        let stderr_tail = Arc::new(Mutex::new(Vec::<String>::new()));

        tokio::spawn(read_stdout(stdout, events.clone(), pending.clone()));
        tokio::spawn(read_stderr(stderr, events.clone(), stderr_tail.clone()));

        let code_child = child;
        Ok(Self {
            child: code_child,
            stdin: writer,
            pending,
            timeouts: Timeouts::default(),
            #[cfg(windows)]
            _job: job,
        })
    }

    /// Sends one line to stdin. Fails when the process is gone.
    pub async fn send_line(&self, line: String) -> Result<(), ()> {
        self.stdin.send(line).await.map_err(|_| ())
    }

    /// Sends a control request and waits for the answer.
    pub async fn request(
        &self,
        subtype: &str,
        fields: serde_json::Map<String, Value>,
    ) -> Result<serde_json::Map<String, Value>, control::ControlError> {
        let timeout = match subtype {
            "initialize" => self.timeouts.initialize,
            _ => self.timeouts.request,
        };
        control::request(&self.stdin, &self.pending, subtype, fields, timeout).await
    }

    pub fn pending(&self) -> &Arc<Pending> {
        &self.pending
    }

    /// Ends the process and everything it started.
    pub async fn kill(&mut self) {
        #[cfg(windows)]
        {
            // The job first: it takes the whole tree, MCP servers included.
            self._job.kill();
        }
        let _ = self.child.kill().await;
        self.pending.fail_all("the session ended");
    }

    /// Waits for it to exit.
    pub async fn wait(&mut self) -> std::io::Result<std::process::ExitStatus> {
        let status = self.child.wait().await;
        if status.is_ok() {
            self.pending.fail_all("the session ended");
        }
        status
    }
}

/// Reads stdout, one line at a time, and hands over each frame.
async fn read_stdout(
    stdout: tokio::process::ChildStdout,
    events: mpsc::Sender<Event>,
    pending: Arc<Pending>,
) {
    let mut reader = BufReader::with_capacity(64 * 1024, stdout);
    let mut decoder = LineDecoder::default();
    let mut buffer = vec![0u8; 32 * 1024];
    loop {
        match tokio::io::AsyncReadExt::read(&mut reader, &mut buffer).await {
            Ok(0) => break,
            Ok(read) => {
                for line in decoder.push(&buffer[..read]) {
                    dispatch(&line, &events, &pending).await;
                }
            }
            Err(error) => {
                tracing::debug!(%error, "stdout could not be read");
                break;
            }
        }
    }
    if let Some(line) = decoder.finish() {
        dispatch(&line, &events, &pending).await;
    }
}

/// Hands one line on: an answer to a control request, or a frame.
async fn dispatch(line: &str, events: &mpsc::Sender<Event>, pending: &Pending) {
    let Some(frame) = Frame::parse(line) else {
        // Not a frame: the CLI's own diagnostics on the wrong stream.
        tracing::debug!(line, "a line that is not a frame");
        return;
    };
    if frame.kind == "control_response" {
        control::complete_from_frame(pending, &frame.body);
        return;
    }
    let _ = events.send(Event::Frame(frame)).await;
}

/// Keeps the last lines of stderr: they are what says why it failed.
async fn read_stderr(
    stderr: tokio::process::ChildStderr,
    events: mpsc::Sender<Event>,
    tail: Arc<Mutex<Vec<String>>>,
) {
    let mut reader = BufReader::with_capacity(8 * 1024, stderr);
    let mut line = Vec::new();
    loop {
        line.clear();
        match reader.read_until(b'\n', &mut line).await {
            Ok(0) => break,
            Ok(_) => {
                let text = String::from_utf8_lossy(&line).trim_end().to_string();
                if text.is_empty() {
                    continue;
                }
                {
                    let mut kept = tail.lock().await;
                    kept.push(text.clone());
                    if kept.len() > 40 {
                        kept.remove(0);
                    }
                }
                let _ = events.send(Event::Stderr(text)).await;
            }
            Err(_) => break,
        }
    }
}

/// Writes whole lines to stdin. One task owns the pipe, so lines never
/// interleave, and a blocked write backs up the channel rather than the
/// task that dispatches frames.
async fn write_stdin(mut stdin: tokio::process::ChildStdin, mut lines: mpsc::Receiver<String>) {
    let mut buffer = Vec::with_capacity(8 * 1024);
    while let Some(line) = lines.recv().await {
        buffer.clear();
        buffer.extend_from_slice(line.as_bytes());
        buffer.push(b'\n');
        if stdin.write_all(&buffer).await.is_err() {
            break;
        }
        if stdin.flush().await.is_err() {
            break;
        }
    }
    let _ = stdin.shutdown().await;
}

/// The process tree, kept together on Windows so a kill takes every child.
#[cfg(windows)]
struct JobHandle(windows_sys::Win32::Foundation::HANDLE);

#[cfg(windows)]
unsafe impl Send for JobHandle {}
#[cfg(windows)]
unsafe impl Sync for JobHandle {}

#[cfg(windows)]
impl JobHandle {
    fn assign(child: &Child) -> Result<Self, std::io::Error> {
        use windows_sys::Win32::System::JobObjects::{
            AssignProcessToJobObject, CreateJobObjectW, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
            JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JobObjectExtendedLimitInformation,
            SetInformationJobObject,
        };

        let raw = child.raw_handle();
        let handle = match raw {
            Some(handle) => handle as windows_sys::Win32::Foundation::HANDLE,
            None => {
                return Err(std::io::Error::other(
                    "the process had no handle to put in a job",
                ))
            }
        };
        // SAFETY: the calls below are the documented way to make a job that
        // kills its members when it closes.
        unsafe {
            let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if job.is_null() {
                return Ok(Self(std::ptr::null_mut()));
            }
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &info as *const _ as *const std::ffi::c_void,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );
            if AssignProcessToJobObject(job, handle) == 0 {
                // A process already in a job (a debugger's) cannot join another.
                tracing::debug!("the process could not join a job object");
            }
            Ok(Self(job))
        }
    }

    fn kill(&self) {
        use windows_sys::Win32::System::JobObjects::TerminateJobObject;
        if self.0.is_null() {
            return;
        }
        // SAFETY: the handle is one this struct made and still owns.
        unsafe {
            TerminateJobObject(self.0, 1);
        }
    }
}

#[cfg(windows)]
impl Drop for JobHandle {
    fn drop(&mut self) {
        use windows_sys::Win32::Foundation::CloseHandle;
        if self.0.is_null() {
            return;
        }
        // SAFETY: closing a handle this struct owns, once.
        unsafe {
            CloseHandle(self.0);
        }
    }
}

/// How long a graceful close waits before the tree is killed.
pub const GRACEFUL_CLOSE: Duration = Duration::from_secs(3);
