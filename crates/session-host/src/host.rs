//! One process a session, and the frames it produces, batched for the
//! window.
//!
//! A long answer streams thousands of token-level frames. Sending each one
//! across IPC saturates the webview's message queue, so frames are gathered
//! and flushed on a timer, in the order they arrived, each with a sequence
//! number the window uses to drop duplicates and to tell a replaced process
//! apart.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Map, Value};
use tokio::sync::{mpsc, Mutex};

use agilegeek_core::AppPaths;
use agilegeek_launcher::locate;
use agilegeek_transport::{Event, Frame, Launch, Process};

use crate::launch::{arguments, environment, SessionOptions};

/// How long frames are gathered before being sent.
const FLUSH_INTERVAL: Duration = Duration::from_millis(16);
/// How many frames are sent at once even if the interval has not passed.
const FLUSH_FRAMES: usize = 64;

/// What the window is told.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "t", rename_all = "camelCase")]
pub enum Envelope {
    /// One batch of frames, in order.
    Frames {
        sid: String,
        epoch: u32,
        items: Vec<Sequenced>,
    },
    /// The process's state.
    Transport {
        sid: String,
        epoch: u32,
        state: &'static str,
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<i32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        stderr: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        executable: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize)]
pub struct Sequenced {
    pub seq: u64,
    pub f: Value,
}

/// A session's process, and the task reading it.
struct Session {
    epoch: u32,
    /// The session id the CLI named, once it has said.
    session_id: Option<String>,
    process: Arc<Mutex<Process>>,
    /// Ends the reading task.
    stop: mpsc::Sender<()>,
}

/// Every session the window has open.
#[derive(Default)]
pub struct SessionHost {
    sessions: Mutex<HashMap<String, Session>>,
    epochs: AtomicU64,
    /// Where the window's envelopes go.
    sink: Mutex<Option<Arc<dyn Fn(Envelope) + Send + Sync>>>,
}

impl SessionHost {
    /// Sets where envelopes go: the window's emitter.
    pub async fn set_sink(&self, sink: Arc<dyn Fn(Envelope) + Send + Sync>) {
        *self.sink.lock().await = Some(sink);
    }

    async fn emit(&self, envelope: Envelope) {
        let sink = self.sink.lock().await.clone();
        if let Some(sink) = sink {
            sink(envelope);
        }
    }

    /// Starts a session, returning the app's id for it.
    pub async fn open(self: &Arc<Self>, id: String, options: SessionOptions) -> Result<String, String> {
        let paths = AppPaths::new(None).map_err(|error| error.to_string())?;
        let located = locate(None, &paths).map_err(|error| error.to_string())?;
        let epoch = self.epochs.fetch_add(1, Ordering::Relaxed) as u32 + 1;

        self.emit(Envelope::Transport {
            sid: id.clone(),
            epoch,
            state: "starting",
            code: None,
            stderr: None,
            executable: Some(located.path.display().to_string()),
            reason: None,
        })
        .await;

        let launch = Launch {
            executable: located.path.clone(),
            args: arguments(&options),
            cwd: options.cwd.clone(),
            env: environment(&[]),
        };

        let (events_tx, events_rx) = mpsc::channel::<Event>(2048);
        let process = Process::start(launch.clone(), events_tx)
            .await
            .map_err(|error| format!("{}: {error}", launch.executable.display()))?;
        let process = Arc::new(Mutex::new(process));

        let (stop_tx, stop_rx) = mpsc::channel::<()>(1);
        let reader = Frames::new(Arc::clone(&self), id.clone(), epoch);
        tokio::spawn(read(reader, events_rx, stop_rx));

        self.emit(Envelope::Transport {
            sid: id.clone(),
            epoch,
            state: "ready",
            code: None,
            stderr: None,
            executable: Some(launch.executable.display().to_string()),
            reason: None,
        })
        .await;

        self.sessions.lock().await.insert(
            id.clone(),
            Session {
                epoch,
                session_id: options.resume.clone(),
                process,
                stop: stop_tx,
            },
        );
        Ok(id)
    }

    /// Writes one message to the session's stdin.
    pub async fn send(&self, id: &str, message: Map<String, Value>) -> Result<(), String> {
        let process = self.process_of(id).await?;
        let process = process.lock().await;
        process
            .send_line(Value::Object(message).to_string())
            .await
            .map_err(|_| "the session's process is gone".to_string())
    }

    /// Sends a user's message.
    pub async fn send_prompt(
        &self,
        id: &str,
        text: &str,
        uuid: &str,
    ) -> Result<(), String> {
        let mut message = Map::new();
        message.insert("type".into(), json!("user"));
        message.insert("uuid".into(), json!(uuid));
        message.insert(
            "message".into(),
            json!({ "role": "user", "content": [{ "type": "text", "text": text }] }),
        );
        self.send(id, message).await
    }

    /// Answers a tool permission request.
    pub async fn answer_permission(
        &self,
        id: &str,
        request_id: &str,
        allow: bool,
        updated_input: Option<Value>,
        message: Option<String>,
        updated_permissions: Option<Value>,
    ) -> Result<(), String> {
        let response = if allow {
            let mut body = Map::new();
            body.insert("behavior".into(), json!("allow"));
            if let Some(input) = updated_input {
                body.insert("updatedInput".into(), input);
            }
            if let Some(permissions) = updated_permissions {
                body.insert("updatedPermissions".into(), permissions);
            }
            Value::Object(body)
        } else {
            json!({
                "behavior": "deny",
                "message": message.unwrap_or_else(|| "The user did not allow this.".into()),
            })
        };
        self.respond(id, request_id, response).await
    }

    /// Sends a control response back to the CLI.
    pub async fn respond(
        &self,
        id: &str,
        request_id: &str,
        response: Value,
    ) -> Result<(), String> {
        let mut message = Map::new();
        message.insert("type".into(), json!("control_response"));
        message.insert(
            "response".into(),
            json!({
                "subtype": "success",
                "request_id": request_id,
                "response": response,
            }),
        );
        self.send(id, message).await
    }

    /// Stops the turn running.
    pub async fn interrupt(&self, id: &str) -> Result<(), String> {
        let mut message = Map::new();
        message.insert("type".into(), json!("control_request"));
        let request_id = format!("int_{}", std::process::id());
        message.insert("request_id".into(), json!(request_id));
        message.insert("request".into(), json!({ "subtype": "interrupt" }));
        self.send(id, message).await
    }

    /// Ends a session and its process.
    pub async fn close(&self, id: &str) -> Result<(), String> {
        let session = self.sessions.lock().await.remove(id);
        let Some(session) = session else {
            return Ok(());
        };
        let _ = session.stop.try_send(());
        let mut process = session.process.lock().await;
        process.kill().await;
        drop(process);
        self.emit(Envelope::Transport {
            sid: id.to_string(),
            epoch: session.epoch,
            state: "exited",
            code: None,
            stderr: None,
            executable: None,
            reason: Some("closed".into()),
        })
        .await;
        Ok(())
    }

    /// Ends every session, for the app quitting.
    pub async fn close_all(&self) {
        let ids: Vec<String> = self.sessions.lock().await.keys().cloned().collect();
        for id in ids {
            self.close(&id).await.ok();
        }
    }

    /// The session id the CLI gave, once it has.
    pub async fn session_id(&self, id: &str) -> Option<String> {
        self.sessions
            .lock()
            .await
            .get(id)
            .and_then(|session| session.session_id.clone())
    }

    async fn process_of(&self, id: &str) -> Result<Arc<Mutex<Process>>, String> {
        self.sessions
            .lock()
            .await
            .get(id)
            .map(|session| session.process.clone())
            .ok_or_else(|| format!("no session {id}"))
    }
}

/// Reads a session's events and forwards them, batched.
struct Frames {
    host: Arc<SessionHost>,
    sid: String,
    epoch: u32,
    seq: u64,
    buffer: Vec<Sequenced>,
    stderr: Vec<String>,
}

impl Frames {
    fn new(host: Arc<SessionHost>, sid: String, epoch: u32) -> Self {
        Self {
            host,
            sid,
            epoch,
            seq: 0,
            buffer: Vec::new(),
            stderr: Vec::new(),
        }
    }

    async fn flush(&mut self) {
        if self.buffer.is_empty() {
            return;
        }
        let items = std::mem::take(&mut self.buffer);
        self.host
            .emit(Envelope::Frames {
                sid: self.sid.clone(),
                epoch: self.epoch,
                items,
            })
            .await;
    }

    fn push(&mut self, frame: Frame) {
        self.seq += 1;
        self.buffer.push(Sequenced {
            seq: self.seq,
            f: frame.to_json(),
        });
    }

    fn full(&self) -> bool {
        self.buffer.len() >= FLUSH_FRAMES
    }
}

async fn read(mut frames: Frames, mut events: mpsc::Receiver<Event>, mut stop: mpsc::Receiver<()>) {
    let mut tick = tokio::time::interval(FLUSH_INTERVAL);
    tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        tokio::select! {
            _ = stop.recv() => break,
            _ = tick.tick() => {
                frames.flush().await;
            }
            event = events.recv() => {
                let Some(event) = event else { break };
                match event {
                    Event::Frame(frame) => {
                        frames.push(frame);
                        if frames.full() {
                            frames.flush().await;
                        }
                    }
                    Event::Stderr(line) => {
                        frames.stderr.push(line);
                        if frames.stderr.len() > 40 {
                            frames.stderr.remove(0);
                        }
                    }
                    Event::Exited { code, .. } => {
                        frames.flush().await;
                        let reason = classify(&frames.stderr);
                        frames.host.emit(Envelope::Transport {
                            sid: frames.sid.clone(),
                            epoch: frames.epoch,
                            state: "exited",
                            code,
                            stderr: Some(frames.stderr.join("\n")),
                            executable: None,
                            reason: Some(reason),
                        }).await;
                        return;
                    }
                }
            }
        }
    }
    frames.flush().await;
}

/// What a failed exit means, in words a user can act on.
pub fn classify(stderr: &[String]) -> String {
    let text = stderr.join("\n").to_lowercase();
    if text.contains("requires --verbose") {
        return "The CLI refused the flags it was started with.".into();
    }
    if text.contains("invalid api key") || text.contains("authentication") {
        return "The model provider rejected the key.".into();
    }
    if text.contains("not logged in") || text.contains("please run /login") {
        return "Not signed in. Sign in with the Claude Code CLI, or configure a provider.".into();
    }
    if text.contains("overloaded") || text.contains("rate limit") {
        return "The model provider is busy or rate limited.".into();
    }
    if stderr.is_empty() {
        "The process ended without saying why.".into()
    } else {
        stderr.last().cloned().unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_failure_says_something_useful() {
        assert!(classify(&["Error: invalid api key".into()]).contains("rejected the key"));
        assert!(classify(&["Error: When using --print, --output-format=stream-json requires --verbose".into()])
            .contains("refused the flags"));
        assert!(classify(&[]).contains("without saying why"));
    }
}
