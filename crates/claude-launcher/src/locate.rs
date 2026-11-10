//! Finding the Claude Code program that will run this session.
//!
//! The order matters. The CLI in the app's own directory is the one the
//! app installed and can reason about: its version, what it supports. A
//! user's own install is next, since it may be newer or signed in to a
//! subscription the downloaded one is not. Both are preferred to the npm
//! shim, which is a `.cmd` that hands the call to `cmd.exe` — and `cmd.exe`
//! re-parses the argument list, splitting the JSON given to `--settings` at
//! its `<` and `>`.

use std::path::{Path, PathBuf};

use agilegeek_core::AppPaths;

/// Where the CLI came from: what the app may say about it, and whether it
/// may update it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Origin {
    /// Downloaded by the app into its data directory.
    Downloaded,
    /// Installed by the user: npm, the native installer, a package manager.
    Installed,
    /// Named in the app's settings.
    Configured,
}

/// A program that can be started, and what is known of it.
#[derive(Debug, Clone)]
pub struct Located {
    pub path: PathBuf,
    pub origin: Origin,
    /// Whether it is a `.cmd`/`.bat` shim, which has to go through the
    /// command interpreter and mangles `--settings`.
    pub through_shell: bool,
    /// What `--version` said, once asked.
    pub version: Option<String>,
}

impl Located {
    /// Whether this is a native executable rather than a shell script.
    pub fn is_native(&self) -> bool {
        !self.through_shell
    }
}

#[derive(Debug, thiserror::Error)]
pub enum LocateError {
    #[error("no Claude Code was found")]
    NotFound,
}

/// Every place a CLI may be found, in the order they are preferred.
pub fn candidates(configured: Option<&Path>, paths: &AppPaths) -> Vec<Located> {
    let mut found: Vec<Located> = Vec::new();

    // 1. What the user named explicitly.
    if let Some(path) = configured {
        if path.is_file() {
            found.push(Located {
                path: path.to_path_buf(),
                origin: Origin::Configured,
                through_shell: is_shim(path),
                version: None,
            });
        }
    }

    // 2. The copy the app downloaded, newest version first.
    for path in downloaded(paths) {
        found.push(Located {
            path,
            origin: Origin::Downloaded,
            through_shell: false,
            version: None,
        });
    }

    // 3. The user's own installations.
    for path in installed() {
        // The same file reached twice (a symlinked npm prefix) is once.
        if found.iter().any(|known| same_file(&known.path, &path)) {
            continue;
        }
        found.push(Located {
            path: path.clone(),
            origin: Origin::Installed,
            through_shell: is_shim(&path),
            version: None,
        });
    }

    // A native program comes before a shim that would run it anyway: the
    // shim adds `cmd.exe` in the middle, and that is what breaks JSON.
    found.sort_by_key(|candidate| (candidate.through_shell, 0));
    found
}

/// Picks the one to run: the first that exists, native ones first.
pub fn locate(configured: Option<&Path>, paths: &AppPaths) -> Result<Located, LocateError> {
    candidates(configured, paths)
        .into_iter()
        .next()
        .ok_or(LocateError::NotFound)
}

/// The versions the app has downloaded, newest first.
pub fn downloaded(paths: &AppPaths) -> Vec<PathBuf> {
    let mut versions: Vec<(u64, u64, u64, PathBuf)> = Vec::new();
    let Ok(entries) = std::fs::read_dir(paths.cli()) else {
        return Vec::new();
    };
    for entry in entries.flatten() {
        let dir = entry.path();
        if !dir.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if let Some(version) = parse_version(&name) {
            let exe = if cfg!(windows) {
                dir.join("claude.exe")
            } else {
                dir.join("claude")
            };
            if exe.is_file() {
                versions.push((version.0, version.1, version.2, exe));
            }
        }
    }
    versions.sort_by(|a, b| b.0.cmp(&a.0).then(b.1.cmp(&a.1)).then(b.2.cmp(&a.2)));
    versions.into_iter().map(|(_, _, _, path)| path).collect()
}

/// `2.1.145` → (2, 1, 145). A directory that is not a version is skipped.
fn parse_version(name: &str) -> Option<(u64, u64, u64)> {
    let mut parts = name.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next()?.parse().ok()?;
    if parts.next().is_some() {
        return None;
    }
    Some((major, minor, patch))
}

/// The user's own installations, in the usual places.
pub fn installed() -> Vec<PathBuf> {
    let mut found = Vec::new();

    // On PATH: a native executable first, then the shim.
    if let Some(path) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path) {
            for name in executable_names() {
                let candidate = dir.join(name);
                if candidate.is_file() {
                    found.push(candidate);
                }
            }
        }
    }

    // The places the installers use when PATH is not set up (a GUI app
    // started from Explorer does not see what a shell would).
    if let Some(home) = home_dir() {
        for relative in [
            ".claude/local/claude.exe",
            ".claude/local/claude",
            ".local/bin/claude",
            "AppData/Roaming/npm/claude.cmd",
            "AppData/Local/Programs/claude/claude.exe",
            "AppData/Local/Volta/bin/claude.exe",
        ] {
            let candidate = home.join(relative);
            if candidate.is_file() && !found.iter().any(|known| same_file(known, &candidate)) {
                found.push(candidate);
            }
        }
        // npm's global prefix, where the package's own binary sits: this is
        // the native one, beside the `.cmd` shim.
        let native = home.join(
            "AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe",
        );
        if native.is_file() {
            found.insert(0, native);
        }
    }

    found
}

fn executable_names() -> &'static [&'static str] {
    if cfg!(windows) {
        &["claude.exe", "claude.cmd", "claude.bat"]
    } else {
        &["claude"]
    }
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
}

/// Whether the path is a shell script rather than a program.
fn is_shim(path: &Path) -> bool {
    match path.extension().and_then(|ext| ext.to_str()) {
        Some(ext) => matches!(ext.to_ascii_lowercase().as_str(), "cmd" | "bat" | "ps1" | "sh"),
        None => false,
    }
}

/// Whether two paths name the same file.
fn same_file(a: &Path, b: &Path) -> bool {
    match (std::fs::canonicalize(a), std::fs::canonicalize(b)) {
        (Ok(a), Ok(b)) => a == b,
        _ => a == b,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_versions() {
        assert_eq!(parse_version("2.1.145"), Some((2, 1, 145)));
        assert_eq!(parse_version("10.0.3"), Some((10, 0, 3)));
        assert_eq!(parse_version("latest"), None);
        assert_eq!(parse_version("2.1"), None);
        assert_eq!(parse_version("2.1.3.4"), None);
    }

    #[test]
    fn a_cmd_shim_is_recognised() {
        assert!(is_shim(Path::new(r"C:\npm\claude.cmd")));
        assert!(is_shim(Path::new("/usr/local/bin/claude.ps1")));
        assert!(!is_shim(Path::new(r"C:\npm\claude.exe")));
        assert!(!is_shim(Path::new("/usr/local/bin/claude")));
    }

    #[test]
    fn the_newest_download_comes_first() {
        let root = std::env::temp_dir().join(format!("agilegeek-launch-{}", std::process::id()));
        let paths = AppPaths::new(Some(root.clone())).expect("paths");
        for version in ["2.1.9", "2.1.145", "2.1.20"] {
            let dir = paths.cli().join(version);
            std::fs::create_dir_all(&dir).expect("dir");
            let exe = dir.join(if cfg!(windows) { "claude.exe" } else { "claude" });
            std::fs::write(&exe, b"#!/bin/sh\n").expect("exe");
        }
        std::fs::create_dir_all(paths.cli().join("not-a-version")).ok();

        let found = downloaded(&paths);
        assert_eq!(found.len(), 3);
        // `Path::ends_with` matches whole components, so the version is
        // read from the directory the executable sits in.
        let version_of = |path: &std::path::Path| {
            path.parent()
                .and_then(|dir| dir.file_name())
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_default()
        };
        assert_eq!(version_of(&found[0]), "2.1.145");
        // 2.1.20 is newer than 2.1.9: compared as numbers, not as text.
        assert_eq!(version_of(&found[1]), "2.1.20");
        assert_eq!(version_of(&found[2]), "2.1.9");

        std::fs::remove_dir_all(root).ok();
    }
}
