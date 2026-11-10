//! The application's directories, laid out the way an editor's are:
//! `User/` for settings, `state/` for what may be thrown away,
//! `checkpoints/` for the agent's file snapshots, and so on.

use std::path::{Path, PathBuf};

/// The name the app writes under, and the one its windows show.
pub const APP_NAME: &str = "AgileGeek";

/// The root directory name: `%LOCALAPPDATA%\AgileGeek` on Windows,
/// `~/Library/Application Support/AgileGeek` on macOS, `~/.local/share/AgileGeek` on Linux.
const DATA_DIR_NAME: &str = "AgileGeek";

/// Every directory the app writes to, made on first use.
#[derive(Debug, Clone)]
pub struct AppPaths {
    root: PathBuf,
}

impl AppPaths {
    /// The paths under the platform's data directory, or under `root` when
    /// one is given (a test, or a `--data-dir` flag).
    pub fn new(root: Option<PathBuf>) -> std::io::Result<Self> {
        let root = root.unwrap_or_else(default_data_dir);
        let paths = Self { root };
        paths.ensure()?;
        Ok(paths)
    }

    /// The root of everything the app keeps.
    pub fn root(&self) -> &Path {
        &self.root
    }

    /// `User/settings.json`, `User/keybindings.json`.
    pub fn user(&self) -> PathBuf {
        self.root.join("User")
    }

    /// Window sizes, open sessions, and other state that may be thrown away.
    pub fn state(&self) -> PathBuf {
        self.root.join("state")
    }

    /// The snapshots taken before the agent edits, and the review index.
    pub fn checkpoints(&self) -> PathBuf {
        self.root.join("checkpoints")
    }

    /// Content-addressed blobs: `<first two hex>/<rest>`.
    pub fn blobs(&self) -> PathBuf {
        self.checkpoints().join("objects")
    }

    /// One JSON a session: which files changed, and whether each can be undone.
    pub fn reviews(&self) -> PathBuf {
        self.checkpoints().join("reviews")
    }

    /// The Claude Code CLI the app downloaded, one directory a version.
    pub fn cli(&self) -> PathBuf {
        self.root.join("cli")
    }

    pub fn logs(&self) -> PathBuf {
        self.root.join("logs")
    }

    pub fn cache(&self) -> PathBuf {
        self.root.join("cache")
    }

    /// The SQLite index of sessions: derived from the CLI's JSONL, and
    /// rebuildable from it at any time.
    pub fn index_db(&self) -> PathBuf {
        self.root.join("index.db")
    }

    /// Makes every directory the app writes to.
    fn ensure(&self) -> std::io::Result<()> {
        for dir in [
            self.root.clone(),
            self.user(),
            self.state(),
            self.checkpoints(),
            self.blobs(),
            self.reviews(),
            self.cli(),
            self.logs(),
            self.cache(),
        ] {
            std::fs::create_dir_all(&dir)?;
        }
        Ok(())
    }
}

/// Where the app keeps its files, by platform.
fn default_data_dir() -> PathBuf {
    if let Some(dir) = std::env::var_os("AGILEGEEK_DATA_DIR") {
        return PathBuf::from(dir);
    }
    #[cfg(target_os = "windows")]
    {
        if let Some(dir) = std::env::var_os("LOCALAPPDATA") {
            return PathBuf::from(dir).join(DATA_DIR_NAME);
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home)
                .join("Library/Application Support")
                .join(DATA_DIR_NAME);
        }
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if let Some(dir) = std::env::var_os("XDG_DATA_HOME") {
            return PathBuf::from(dir).join(DATA_DIR_NAME);
        }
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home).join(".local/share").join(DATA_DIR_NAME);
        }
    }
    std::env::temp_dir().join(DATA_DIR_NAME)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn makes_every_directory() {
        let root = std::env::temp_dir().join(format!("agilegeek-paths-{}", std::process::id()));
        let paths = AppPaths::new(Some(root.clone())).expect("paths");
        for dir in [
            paths.user(),
            paths.state(),
            paths.blobs(),
            paths.reviews(),
            paths.cli(),
            paths.logs(),
        ] {
            assert!(dir.is_dir(), "{} was not made", dir.display());
        }
        std::fs::remove_dir_all(root).ok();
    }
}
