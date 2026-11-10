//! Finding, fetching and starting the Claude Code program.

pub mod download;
pub mod locate;

pub use download::{install, latest_release, DownloadError, Progress, Release};
pub use locate::{candidates, downloaded, locate, LocateError, Located, Origin};
