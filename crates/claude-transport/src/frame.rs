//! One line of the CLI's stdout, read leniently.
//!
//! The stream-json protocol is not a published contract. A frame this
//! build does not know is kept as it came rather than rejected, and a line
//! that is not JSON at all (a Windows codepage warning, a bundler notice)
//! is passed over: neither may end the session.

use serde_json::{Map, Value};

/// One decoded frame, its `type` read out.
#[derive(Debug, Clone)]
pub struct Frame {
    /// The frame's `type`, e.g. `assistant`, `system`, `result`.
    pub kind: String,
    /// The frame as it came, whole.
    pub body: Map<String, Value>,
}

impl Frame {
    /// Reads a line. Returns `None` when the line is not a JSON object.
    pub fn parse(line: &str) -> Option<Self> {
        let text = line.trim();
        if text.is_empty() {
            return None;
        }
        let value: Value = serde_json::from_str(text).ok()?;
        let body = match value {
            Value::Object(map) => map,
            _ => return None,
        };
        let kind = match body.get("type") {
            Some(Value::String(kind)) => kind.clone(),
            _ => return None,
        };
        Some(Self { kind, body })
    }

    /// The `subtype` of a `system` frame, if it has one.
    pub fn subtype(&self) -> Option<&str> {
        self.body.get("subtype").and_then(Value::as_str)
    }

    /// The frame as JSON, for storing or forwarding.
    pub fn to_json(&self) -> Value {
        Value::Object(self.body.clone())
    }

    /// A string field of the frame.
    pub fn str_field(&self, key: &str) -> Option<&str> {
        self.body.get(key).and_then(Value::as_str)
    }
}

/// Decodes a byte stream into lines, tolerating what the CLI writes on
/// Windows: a codepage other than UTF-8 in its own error text.
pub struct LineDecoder {
    buffer: Vec<u8>,
    /// Cap on a single line. A runaway line must not eat the process's memory.
    max_line: usize,
}

impl Default for LineDecoder {
    fn default() -> Self {
        Self::new(8 * 1024 * 1024)
    }
}

impl LineDecoder {
    pub fn new(max_line: usize) -> Self {
        Self {
            buffer: Vec::with_capacity(16 * 1024),
            max_line,
        }
    }

    /// Adds bytes, returning the lines they completed.
    pub fn push(&mut self, bytes: &[u8]) -> Vec<String> {
        let mut lines = Vec::new();
        let mut start = 0;
        for (at, byte) in bytes.iter().enumerate() {
            if *byte != b'\n' {
                continue;
            }
            let mut line = std::mem::take(&mut self.buffer);
            line.extend_from_slice(&bytes[start..at]);
            lines.push(decode(&line));
            start = at + 1;
        }
        self.buffer.extend_from_slice(&bytes[start..]);
        if self.buffer.len() > self.max_line {
            tracing::warn!(
                bytes = self.buffer.len(),
                "a line longer than the cap was dropped"
            );
            self.buffer.clear();
        }
        lines
    }

    /// What is left when the stream ends: a last line with no newline.
    pub fn finish(&mut self) -> Option<String> {
        if self.buffer.is_empty() {
            return None;
        }
        let line = decode(&std::mem::take(&mut self.buffer));
        Some(line)
    }
}

/// UTF-8 where it can be, lossy where the CLI's own text is not.
fn decode(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(text) => text.to_string(),
        Err(_) => String::from_utf8_lossy(bytes).into_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_frames() {
        let frame = Frame::parse(r#"{"type":"assistant","message":{}}"#).expect("frame");
        assert_eq!(frame.kind, "assistant");
    }

    #[test]
    fn passes_over_what_is_not_a_frame() {
        assert!(Frame::parse("Warning: something happened").is_none());
        assert!(Frame::parse("[1,2,3]").is_none());
        assert!(Frame::parse(r#"{"no_type":1}"#).is_none());
        assert!(Frame::parse("").is_none());
    }

    #[test]
    fn splits_lines_across_chunks() {
        let mut decoder = LineDecoder::default();
        assert!(decoder.push(b"{\"type\":\"a\"").is_empty());
        let lines = decoder.push(b"}\n{\"type\":\"b\"}\n");
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0], r#"{"type":"a"}"#);
        assert_eq!(lines[1], r#"{"type":"b"}"#);
    }

    #[test]
    fn keeps_a_last_line_without_a_newline() {
        let mut decoder = LineDecoder::default();
        decoder.push(b"{\"type\":\"a\"}");
        assert_eq!(decoder.finish().as_deref(), Some(r#"{"type":"a"}"#));
    }

    #[test]
    fn survives_bytes_that_are_not_utf8() {
        // A Windows codepage byte in the CLI's own text.
        let mut decoder = LineDecoder::default();
        let lines = decoder.push(b"\xff\xfe not json\n");
        assert_eq!(lines.len(), 1);
        assert!(!lines[0].is_empty());
    }
}
