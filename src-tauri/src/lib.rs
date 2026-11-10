//! The window, and the commands it may call.
//!
//! Kept thin on purpose: what a session is, and how it is driven, lives in
//! the crates under `crates/`. This is the edge the webview sees.

use agilegeek_core::AppPaths;

/// What the front end is told about the app on start.
#[derive(serde::Serialize)]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
    /// Where sessions, checkpoints and logs are kept.
    pub data_dir: String,
}

/// The app's identity and where it writes.
#[tauri::command]
fn app_info() -> AppInfo {
    let data_dir = AppPaths::new(None)
        .map(|paths| paths.root().display().to_string())
        .unwrap_or_default();
    AppInfo {
        name: "灵动极客",
        version: env!("CARGO_PKG_VERSION"),
        data_dir,
    }
}

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "agilegeek=info,agilegeek_transport=info".into()),
        )
        .init();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_info])
        .run(tauri::generate_context!())
        .expect("the app could not start");
}
