//! Sessions: one Claude Code process each, and the frames it produces.

pub mod host;
pub mod launch;

pub use host::{classify, Envelope, Sequenced, SessionHost};
pub use launch::{arguments, environment, SessionOptions, APPENDED_PROMPT};
