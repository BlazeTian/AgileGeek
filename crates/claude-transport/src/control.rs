//! The control channel: requests the CLI sends the host, and the answers.
//!
//! Both directions share one JSON-lines pipe, so every request carries an
//! id and every answer names it. A request that is never answered stops
//! the CLI dead, so each has a deadline.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use serde_json::{json, Map, Value};
use tokio::sync::{mpsc, oneshot};

/// How long each kind of request may take.
#[derive(Debug, Clone, Copy)]
pub struct Timeouts {
    /// `initialize` starts the session; a slow machine may take a while.
    pub initialize: Duration,
    /// Anything else.
    pub request: Duration,
}

impl Default for Timeouts {
    fn default() -> Self {
        Self {
            initialize: Duration::from_secs(30),
            request: Duration::from_secs(60),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ControlError {
    #[error("the session ended")]
    Closed,
    #[error("the CLI answered with an error: {0}")]
    Refused(String),
    #[error("no answer within {0:?}")]
    Timeout(Duration),
}

type Answer = Result<Map<String, Value>, String>;

/// Requests out on their way, by id, waiting for the answer.
#[derive(Default)]
pub struct Pending {
    next: AtomicU64,
    waiting: std::sync::Mutex<HashMap<String, oneshot::Sender<Answer>>>,
}

impl Pending {
    /// Makes the next id, e.g. `req_7`.
    pub fn id(&self) -> String {
        format!("req_{}", self.next.fetch_add(1, Ordering::Relaxed))
    }

    /// Registers a wait for `id`.
    pub fn wait(&self, id: &str) -> oneshot::Receiver<Answer> {
        let (tx, rx) = oneshot::channel();
        if let Ok(mut waiting) = self.waiting.lock() {
            waiting.insert(id.to_string(), tx);
        }
        rx
    }

    /// Answers `id` with what the CLI said.
    pub fn complete(&self, id: &str, answer: Answer) {
        let sender = self.waiting.lock().ok().and_then(|mut waiting| waiting.remove(id));
        if let Some(sender) = sender {
            let _ = sender.send(answer);
        }
    }

    /// Fails everything outstanding: the process is gone.
    pub fn fail_all(&self, reason: &str) {
        let waiting = match self.waiting.lock() {
            Ok(mut waiting) => std::mem::take(&mut *waiting),
            Err(_) => return,
        };
        for (_, sender) in waiting {
            let _ = sender.send(Err(reason.to_string()));
        }
    }

    /// How many are outstanding.
    pub fn len(&self) -> usize {
        self.waiting.lock().map(|waiting| waiting.len()).unwrap_or(0)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

/// Sends one request and waits for its answer.
pub async fn request(
    out: &mpsc::Sender<String>,
    pending: &Pending,
    subtype: &str,
    fields: Map<String, Value>,
    timeout: Duration,
) -> Result<Map<String, Value>, ControlError> {
    let id = pending.id();
    let mut request = fields;
    request.insert("subtype".into(), Value::String(subtype.into()));
    let line = json!({
        "type": "control_request",
        "request_id": id,
        "request": Value::Object(request),
    })
    .to_string();

    let answer = pending.wait(&id);
    if out.send(line).await.is_err() {
        return Err(ControlError::Closed);
    }

    match tokio::time::timeout(timeout, answer).await {
        Err(_) => {
            // Stop waiting: the id must not be answered into a dead channel later.
            pending.complete(&id, Err("timed out".into()));
            Err(ControlError::Timeout(timeout))
        }
        Ok(Err(_)) => Err(ControlError::Closed),
        Ok(Ok(Ok(response))) => Ok(response),
        Ok(Ok(Err(message))) => Err(ControlError::Refused(message)),
    }
}

/// Reads a `control_response` frame and hands its answer to the waiter.
pub fn complete_from_frame(pending: &Pending, frame: &Map<String, Value>) {
    let Some(response) = frame.get("response").and_then(Value::as_object) else {
        return;
    };
    let Some(id) = response.get("request_id").and_then(Value::as_str) else {
        return;
    };
    let answer = match response.get("subtype").and_then(Value::as_str) {
        Some("error") => Err(response
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("refused")
            .to_string()),
        _ => Ok(response
            .get("response")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default()),
    };
    pending.complete(id, answer);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn an_answer_reaches_its_waiter() {
        let pending = Pending::default();
        let receiver = pending.wait("req_1");
        pending.complete("req_1", Ok(Map::new()));
        assert!(receiver.await.expect("answer").is_ok());
    }

    #[tokio::test]
    async fn an_error_answer_is_refused() {
        let pending = Pending::default();
        let receiver = pending.wait("req_1");
        complete_from_frame(
            &pending,
            &json!({"response":{"subtype":"error","request_id":"req_1","error":"nope"}})
                .as_object()
                .unwrap()
                .clone(),
        );
        match receiver.await.expect("answer") {
            Err(message) => assert_eq!(message, "nope"),
            Ok(_) => panic!("expected a refusal"),
        }
    }

    #[tokio::test]
    async fn failing_all_reaches_every_waiter() {
        let pending = Pending::default();
        let first = pending.wait("a");
        let second = pending.wait("b");
        pending.fail_all("the session ended");
        assert!(first.await.expect("answer").is_err());
        assert!(second.await.expect("answer").is_err());
        assert!(pending.is_empty());
    }

    #[tokio::test]
    async fn a_request_with_no_answer_times_out() {
        let (tx, _rx) = mpsc::channel(4);
        let pending = Pending::default();
        let result = request(
            &tx,
            &pending,
            "initialize",
            Map::new(),
            Duration::from_millis(20),
        )
        .await;
        assert!(matches!(result, Err(ControlError::Timeout(_))));
        assert!(pending.is_empty(), "the waiter must not be left behind");
    }
}
