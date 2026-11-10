//! A Claude Code session's process: the stream-json protocol, the control
//! channel, and the two pipes between.
//!
//! Nothing here knows what a tool call is. The frames go on, whole, to
//! whoever renders them; the only parts read here are the ones that say
//! how to keep talking (`control_response`, `system/init`).

pub mod control;
pub mod frame;
pub mod process;

pub use control::{ControlError, Pending, Timeouts};
pub use frame::{Frame, LineDecoder};
pub use process::{Event, Launch, Process, GRACEFUL_CLOSE};
