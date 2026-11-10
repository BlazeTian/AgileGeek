# 灵动极客 · AgileGeek

A fast desktop coding agent for Windows, built on the [Claude Code](https://github.com/anthropics/claude-code) CLI.

AgileGeek is a window onto Claude Code: the agent, its tools, skills, MCP servers and hooks are the ones you already have — this is the interface that makes a long session readable and a changed file reviewable.

## Why another one

Terminals run an agent well and read it badly. Diffs scroll away, earlier steps are hard to find again, and reviewing what changed means switching apps.

AgileGeek is what we wanted that window to be:

- **Built for reading.** Reads, searches and commands fold into a line. What the agent changed can be kept or undone, a file or a hunk at a time; the snapshots live in the app's own data directory, not in your repository's `.git`.
- **Fast.** A native shell (Tauri) with the system webview, not a bundled browser. Cold start under half a second, a 15 MB installer, and an editor that loads only when you open it.
- **Any model.** Point it at a provider you already have — DeepSeek's Anthropic-compatible endpoint among them — or at Claude itself.
- **Yours.** Settings, keybindings and sessions are plain files you can read, back up and sync.

## Status

Early development. What works today is the foundation: the protocol, the conversation reducer and the CLI transport, all covered by tests. See [docs/decisions.md](docs/decisions.md) for the architecture calls made so far.

## Requirements

- Windows 10 or later
- [Claude Code](https://github.com/anthropics/claude-code) installed (AgileGeek will offer to fetch it if not)
- A model: Anthropic, or any Anthropic-compatible endpoint

## Building from source

```sh
npm install
npm run build -w @agilegeek/desktop
cargo build --release
```

To run the app in development:

```sh
npm run dev -w @agilegeek/desktop   # the webview's dev server
cargo run -p agilegeek              # the shell
```

## Layout

| Path | What is there |
| --- | --- |
| `apps/desktop` | The window: React, the conversation view, the editor and the terminal |
| `packages/protocol` | The types of what Claude Code writes, and of what the shell sends the window |
| `packages/kernel` | The conversation as a pure reducer: folding, streaming, replays |
| `crates/claude-transport` | The CLI's process, its stream-json protocol, and the control channel |
| `crates/claude-launcher` | Finding, downloading and starting the CLI |
| `crates/session-host` | One process a session: idle release, wake-up, crash recovery |
| `crates/file-review` | Snapshots of edited files, and the three-way merge that undoes one |
| `crates/pty-host` | Pseudo terminals, for the terminal panel |
| `crates/app-core` | Paths, settings, logs |
| `src-tauri` | The shell itself: window, tray, updates |

## License

Proprietary. All rights reserved.
