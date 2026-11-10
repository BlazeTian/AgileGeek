//! The window, and the commands it may call.
//!
// Tauri passes command arguments by their JavaScript names, so they are
// camelCase here on purpose.
#![allow(non_snake_case)]

//! Kept thin: what a session is lives in `agilegeek-session`. This is the
//! edge the webview sees, and the place the session host's envelopes are
//! pushed out.

use std::sync::Arc;

use agilegeek_core::AppPaths;
use agilegeek_session::{Envelope, SessionHost, SessionOptions};
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;

/// What the front end is told about the app on start.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
    /// Where sessions, snapshots and logs are kept.
    pub data_dir: String,
    /// The Claude Code the app will run, if one was found.
    pub cli: Option<String>,
    pub cli_version: Option<String>,
}

struct AppState {
    host: Arc<SessionHost>,
    /// Held for the duration of a start, so two clicks make one session.
    starting: Mutex<()>,
}

#[tauri::command]
async fn app_info(state: tauri::State<'_, AppState>) -> Result<AppInfo, String> {
    let paths = AppPaths::new(None).map_err(|error| error.to_string())?;
    let located = agilegeek_launcher::locate(None, &paths).ok();
    let (cli, cli_version) = match located {
        Some(found) => {
            let version = agilegeek_launcher::download::version_of(&found.path).await;
            (Some(found.path.display().to_string()), version)
        }
        None => (None, None),
    };
    let _ = &state;
    Ok(AppInfo {
        name: "灵动极客",
        version: env!("CARGO_PKG_VERSION"),
        data_dir: paths.root().display().to_string(),
        cli,
        cli_version,
    })
}

/// Fetches a Claude Code into the app's own directory, reporting progress
/// as it goes.
#[tauri::command]
async fn install_cli(app: tauri::AppHandle) -> Result<String, String> {
    let paths = AppPaths::new(None).map_err(|error| error.to_string())?;
    let release = agilegeek_launcher::latest_release()
        .await
        .map_err(|error| error.to_string())?;

    let handle = app.clone();
    let exe = agilegeek_launcher::install(&paths, &release, move |progress| {
        let (kind, so_far, total) = match progress {
            agilegeek_launcher::Progress::Starting { total, .. } => ("starting", 0, total),
            agilegeek_launcher::Progress::Downloaded { so_far, total } => {
                ("downloading", so_far, total)
            }
            agilegeek_launcher::Progress::Unpacking => ("unpacking", 0, 0),
            agilegeek_launcher::Progress::Done { .. } => ("done", 0, 0),
        };
        let _ = handle.emit(
            "agilegeek://cli",
            serde_json::json!({ "kind": kind, "soFar": so_far, "total": total }),
        );
    })
    .await
    .map_err(|error| error.to_string())?;

    Ok(exe.display().to_string())
}

/// Starts a session on a folder.
#[tauri::command]
async fn session_open(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    id: String,
    options: SessionOptions,
) -> Result<String, String> {
    let _guard = state.starting.lock().await;
    let host = Arc::clone(&state.host);

    // Envelopes go out on one event; the window routes them by session id.
    let emitter = app.clone();
    host.set_sink(Arc::new(move |envelope: Envelope| {
        let _ = emitter.emit("agilegeek://envelope", &envelope);
    }))
    .await;

    host.open(id, options).await
}

/// One entry of a directory, as the file tree shows it.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct FsEntry {
    name: String,
    path: String,
    #[serde(rename = "isDir")]
    is_dir: bool,
    children: Option<Vec<FsEntry>>,
}

/// Lists a directory, one level, folders first then files, each by name.
///
/// Hidden entries and the ones no one opens in a tree are left out. Depth
/// is one: the window asks again when a folder is expanded, so a large
/// repository costs nothing until it is looked at.
#[tauri::command]
async fn fs_list(path: String) -> Result<Vec<FsEntry>, String> {
    const SKIP: &[&str] = &[
        ".git", "node_modules", "target", ".next", "dist", ".cache", "__pycache__",
    ];
    let mut entries = Vec::new();
    let directory = std::fs::read_dir(&path).map_err(|error| error.to_string())?;
    for entry in directory.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || SKIP.contains(&name.as_str()) {
            continue;
        }
        let Ok(kind) = entry.file_type() else { continue };
        let child = entry.path().display().to_string();
        let is_dir = kind.is_dir();
        let children = if is_dir {
            // One level more, so a folder opens without a round trip.
            Some(list_one_level(&entry.path()))
        } else {
            None
        };
        entries.push(FsEntry {
            name,
            path: child,
            is_dir,
            children,
        });
    }
    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.cmp(&b.name)));
    Ok(entries)
}

/// A folder's entries without recursing further.
fn list_one_level(path: &std::path::Path) -> Vec<FsEntry> {
    const LIMIT: usize = 60;
    let mut entries = Vec::new();
    let Ok(directory) = std::fs::read_dir(path) else {
        return entries;
    };
    for entry in directory.flatten().take(LIMIT) {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "node_modules" || name == "target" {
            continue;
        }
        let Ok(kind) = entry.file_type() else { continue };
        entries.push(FsEntry {
            name,
            path: entry.path().display().to_string(),
            is_dir: kind.is_dir(),
            children: None,
        });
    }
    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.cmp(&b.name)));
    entries
}

/// The folder a conversation starts in when none is chosen: the user's own.
#[tauri::command]
fn home_dir() -> String {
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_default()
}

#[tauri::command]
async fn session_send(
    state: tauri::State<'_, AppState>,
    id: String,
    text: String,
    uuid: String,
) -> Result<(), String> {
    state.host.send_prompt(&id, &text, &uuid).await
}

#[tauri::command]
async fn session_interrupt(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    state.host.interrupt(&id).await
}

#[tauri::command]
async fn session_close(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    state.host.close(&id).await
}

#[tauri::command]
async fn permission_answer(
    state: tauri::State<'_, AppState>,
    id: String,
    requestId: String,
    allow: bool,
    updatedInput: Option<serde_json::Value>,
    message: Option<String>,
    updatedPermissions: Option<serde_json::Value>,
) -> Result<(), String> {
    state
        .host
        .answer_permission(
            &id,
            &requestId,
            allow,
            updatedInput,
            message,
            updatedPermissions,
        )
        .await
}

/// Answers a question the CLI asked (`AskUserQuestion`), through the same
/// control response as a permission.
#[tauri::command]
async fn question_answer(
    state: tauri::State<'_, AppState>,
    id: String,
    requestId: String,
    answers: serde_json::Value,
    updatedInput: Option<serde_json::Value>,
) -> Result<(), String> {
    let mut input = updatedInput.unwrap_or_else(|| serde_json::json!({}));
    if let Some(object) = input.as_object_mut() {
        object.insert("answers".into(), answers);
    }
    state
        .host
        .answer_permission(&id, &requestId, true, Some(input), None, None)
        .await
}

/// Temporary: writes the webview's viewport where the layout can be checked.
#[tauri::command]
async fn report_viewport(width: u32, height: u32, dpr: f64) -> Result<(), String> {
    let paths = AppPaths::new(None).map_err(|error| error.to_string())?;
    let text = format!("{width}x{height} dpr={dpr}
");
    std::fs::write(paths.root().join("viewport.txt"), text).map_err(|e| e.to_string())
}

/// Fits the window to the screen it opens on.
///
/// A window sized in the config is sized in logical pixels, and at a scale
/// like 150% that comes out larger than the monitor: the right column would
/// hang off the edge. Taking the monitor's own work area and leaving a
/// margin is the one measure that holds at every scale.
#[allow(dead_code)]
fn fit_to_screen(window: &tauri::WebviewWindow) {
    let Ok(Some(monitor)) = window.current_monitor() else {
        return;
    };
    let scale = monitor.scale_factor();
    let size = monitor.size().to_logical::<f64>(scale);
    let pos = monitor.position().to_logical::<f64>(scale);

    // Leave room for the taskbar and the window's own frame.
    let width = (size.width - 24.0).max(900.0);
    let height = (size.height - 72.0).max(600.0);

    // A size set before the webview has laid out can leave it drawing at the
    // config's size while the window is larger: the right column then sits
    // outside the visible area. Two sizes, a frame apart, make the webview
    // lay out again at the second one.
    let _ = window.set_size(tauri::LogicalSize::new(width - 40.0, height - 40.0));
    let _ = window.set_position(tauri::LogicalPosition::new(
        pos.x + (size.width - width) / 2.0,
        pos.y + (size.height - height) / 2.0 + 8.0,
    ));
    let later = window.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        let _ = later.set_size(tauri::LogicalSize::new(width, height));
    });
}

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "agilegeek=info,agilegeek_session=info".into()),
        )
        .init();

    let host = Arc::new(SessionHost::default());

    tauri::Builder::default()
        .manage(AppState {
            host: Arc::clone(&host),
            starting: Mutex::new(()),
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            install_cli,
            fs_list,
            home_dir,
            report_viewport,
            session_open,
            session_send,
            session_interrupt,
            session_close,
            permission_answer,
            question_answer,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state = window.state::<AppState>();
                let host = Arc::clone(&state.host);
                tauri::async_runtime::spawn(async move {
                    host.close_all().await;
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("the app could not start");
}
