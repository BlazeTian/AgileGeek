//! What a session is started with: the CLI's arguments, and the
//! environment it runs in.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// How a session is started.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionOptions {
    /// The folder the agent works in.
    pub cwd: PathBuf,
    /// A session to continue, by id.
    pub resume: Option<String>,
    /// The model to ask for; the CLI's own choice when absent.
    pub model: Option<String>,
    /// `default`, `acceptEdits`, `plan`, `bypassPermissions`, `dontAsk`, `auto`.
    pub permission_mode: Option<String>,
    /// Extra folders the agent may work in.
    #[serde(default)]
    pub directories: Vec<String>,
    /// Written as the `--settings` JSON: a patch over the user's own.
    pub settings: Option<serde_json::Value>,
    /// Added to the system prompt.
    pub append_system_prompt: Option<String>,
}

/// The messages stop coming after this many.
pub const DEFAULT_MAX_TURNS: u32 = 0;

/// The arguments a session is started with.
///
/// The first four flags are not optional: `--print` with
/// `--output-format stream-json` refuses to start without `--verbose`, and
/// without `--permission-prompt-tool stdio` the CLI would approve tool
/// calls itself instead of asking.
pub fn arguments(options: &SessionOptions) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "-p".into(),
        "--input-format".into(),
        "stream-json".into(),
        "--output-format".into(),
        "stream-json".into(),
        "--verbose".into(),
        "--include-partial-messages".into(),
        "--replay-user-messages".into(),
        "--permission-prompt-tool".into(),
        "stdio".into(),
        "--thinking-display".into(),
        "summarized".into(),
    ];

    if let Some(mode) = &options.permission_mode {
        args.push("--permission-mode".into());
        args.push(mode.clone());
    }
    if let Some(model) = &options.model {
        args.push("--model".into());
        args.push(model.clone());
    }
    if let Some(resume) = &options.resume {
        args.push("--resume".into());
        args.push(resume.clone());
    }
    for directory in &options.directories {
        args.push("--add-dir".into());
        args.push(directory.clone());
    }
    if let Some(settings) = &options.settings {
        args.push("--settings".into());
        args.push(settings.to_string());
    }
    if let Some(prompt) = &options.append_system_prompt {
        if !prompt.is_empty() {
            args.push("--append-system-prompt".into());
            args.push(prompt.clone());
        }
    }
    args
}

/// The environment a session runs in.
///
/// The user's own, unchanged: that is what makes a CLI in the app's folder
/// read `~/.claude/settings.json`, `CLAUDE.md` and the model set up there.
/// Only what would confuse it is taken out.
pub fn environment(extra: &[(String, String)]) -> Vec<(String, String)> {
    let mut env: Vec<(String, String)> = std::env::vars()
        // A GUI process inherits whatever started it; nothing here should
        // reach the agent's own requests.
        .filter(|(name, _)| {
            !matches!(
                name.as_str(),
                // Set by an editor's plugin host, not by the user's shell.
                "ELECTRON_RUN_AS_NODE"
                    | "VSCODE_PID"
                    | "VSCODE_IPC_HOOK"
                    // Node's inspector, which belongs to the app, not the CLI.
                    | "NODE_OPTIONS"
            )
        })
        .collect();
    for (name, value) in extra {
        env.retain(|(known, _)| known != name);
        env.push((name.clone(), value.clone()));
    }
    env
}

/// The prompt the app adds to Claude Code's own: how to write for this
/// window.
pub const APPENDED_PROMPT: &str = "\
The user reads your answers in a desktop window that renders GitHub-flavored Markdown.

- Point at code as `file_path:line_number`, so the user can open it.
- Reference files with their absolute path in a Markdown link.
- TeX ($...$ on one line, $$...$$ on its own) and Mermaid diagrams are drawn.
- Local images are shown.
- A <details> block is folded; put long output in one.";

#[cfg(test)]
mod tests {
    use super::*;

    fn options() -> SessionOptions {
        SessionOptions {
            cwd: PathBuf::from(r"C:\work"),
            resume: None,
            model: None,
            permission_mode: None,
            directories: Vec::new(),
            settings: None,
            append_system_prompt: None,
        }
    }

    #[test]
    fn the_required_flags_are_always_there() {
        let args = arguments(&options());
        // Without these the CLI refuses to start, or never asks permission.
        assert!(args.windows(2).any(|pair| pair == ["--verbose", "--include-partial-messages"]));
        assert!(args.contains(&"--verbose".to_string()));
        assert!(args.windows(2).any(|pair| pair == ["--permission-prompt-tool", "stdio"]));
        assert!(args.windows(2).any(|pair| pair == ["--output-format", "stream-json"]));
    }

    #[test]
    fn options_become_flags() {
        let mut opts = options();
        opts.resume = Some("abc".into());
        opts.model = Some("deepseek-chat".into());
        opts.permission_mode = Some("plan".into());
        opts.directories = vec![r"D:\other".into()];
        let args = arguments(&opts);
        assert!(args.windows(2).any(|pair| pair == ["--resume", "abc"]));
        assert!(args.windows(2).any(|pair| pair == ["--model", "deepseek-chat"]));
        assert!(args.windows(2).any(|pair| pair == ["--permission-mode", "plan"]));
        assert!(args.windows(2).any(|pair| pair == ["--add-dir", r"D:\other"]));
    }

    #[test]
    fn an_empty_prompt_is_not_passed() {
        let mut opts = options();
        opts.append_system_prompt = Some(String::new());
        assert!(!arguments(&opts).contains(&"--append-system-prompt".to_string()));
    }

    #[test]
    fn the_environment_keeps_the_users_own() {
        std::env::set_var("AGILEGEEK_TEST_KEEP", "1");
        let env = environment(&[("ANTHROPIC_MODEL".into(), "x".into())]);
        assert!(env.iter().any(|(name, _)| name == "AGILEGEEK_TEST_KEEP"));
        // The extra one wins, and is there once.
        let models: Vec<_> = env
            .iter()
            .filter(|(name, _)| name == "ANTHROPIC_MODEL")
            .collect();
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].1, "x");
        std::env::remove_var("AGILEGEEK_TEST_KEEP");
    }
}
