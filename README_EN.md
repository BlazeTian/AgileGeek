# AgileGeek

<p align="center">
  <img src="site/brand/agilegeek-icon-256.png" width="120" alt="AgileGeek" />
</p>

<p align="center">
  <b>Make an agent's work something you can read, follow and undo.</b><br />
  A native desktop app with a millisecond-fast IDE built in.
</p>

<p align="center">
  <img alt="Dart" src="https://img.shields.io/badge/Dart-3.13-0175C2?logo=dart&logoColor=white&style=flat-square" />
  <img alt="Flutter" src="https://img.shields.io/badge/Flutter-3.47-02569B?logo=flutter&logoColor=white&style=flat-square" />
  <img alt="Platform" src="https://img.shields.io/badge/Windows%20·%20macOS%20·%20Linux-3B82F6?style=flat-square" />
  <img alt="License" src="https://img.shields.io/badge/License-GPL--3.0--only-8B5CF6?style=flat-square" />
  <img alt="Version" src="https://img.shields.io/badge/Version-0.1.1-EAB308?style=flat-square" />
</p>

<p align="center">
  <a href="#philosophy">Philosophy</a> ·
  <a href="#why">Why AgileGeek</a> ·
  <a href="#features">Features</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#development">Development</a>
</p>

---

<a id="philosophy"></a>

## Philosophy

**A tool should make the work lighter, not heavier.**

An agent reads files, runs commands, edits code — and a single task sends hundreds of actions past you unseen. The problem was never that it isn't capable. It's that **you can't see what it did**:

- Can you find the change it made five minutes ago?
- It says "fixed" — which line, and on what basis?
- This approach isn't working and you want another — do you have to start over?
- It finished a task overnight — where's the result?

Most workbenches are "a window around a terminal". AgileGeek aims further: **every step of an agent's work becomes something you can stop at, open, and step back from.**

<a id="why"></a>

## Why AgileGeek

<table>
<tr><td width="50%" valign="top">

**Readable**

- Every read, search and command folds into a single line
- Long tasks become steps you can scroll back through
- Changes shown file by file: what was added, what was removed

</td><td width="50%" valign="top">

**Followable**

- Each step keeps its full record, output and result included
- A conversation can restart from any message
- File changes have their own checkpoints, never polluting your Git history

</td></tr>
<tr><td valign="top">

**Undoable**

- Keep or undo a single file, down to that one edit
- Edit a sent message and resend, optionally rewinding files too
- A failed exploration returns to where it started in one step

</td><td valign="top">

**Uncompromised**

- Drawn natively: fast to start, light to run — not a web shell
- IDE and conversation in one window
- Not tied to a single model provider

</td></tr>
</table>

<a id="features"></a>

## Features

**Conversation**

- A reading-first interface: reads, searches and commands fold into single lines; long conversations become steps
- Change review: each edit file by file, kept or undone; checkpoints in the app's data folder, never in your `.git`
- Goals: type `/goal` and what you want done; progress shows above the input
- Rich input: code from the editor arrives as a file-and-line reference; pasted images and dropped files stay where you put them
- Queue and edit: messages queue while busy, and a sent message can be edited and resent
- Up to four conversations side by side, each with its own scroll and input

**IDE**

- A native editor with syntax highlighting, multi-cursor, folding, find/replace and a minimap
- Language features over LSP: completion, definitions, references, rename, format, code actions, diagnostics
- A built-in terminal with splits and tabs
- Source control with a commit graph, staging, change lists and conflict resolution
- VS Code themes, applied to the editor, the conversation and the sidebar alike

**Engineering**

- Any model: add an upstream speaking Anthropic's API, OpenAI Chat Completions or OpenAI Responses; a local proxy translates; keys stay in the system keychain
- Remote projects over SSH: the window stays local, the work runs on the host
- Multiple windows, system notifications, and a stash for notes you hand to an agent later

<a id="getting-started"></a>

## Getting started

1. Download the installer from [Releases](https://github.com/BlazeTian/AgileGeek/releases)
2. Open it and add a model upstream (Settings → Models)
3. Pick a project folder and start a conversation

Requirements: Windows 10+ (x64 or arm64), macOS 12+ (Apple silicon or Intel), or Ubuntu 20.04+ and other Debian-based distributions (x64 or arm64).

<a id="architecture"></a>

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│  Windows   chat · IDE · agent · stash                        │
├──────────────────────────────────────────────────────────────┤
│  Chat      ChatSession ── Transcript ── ChatItem ── widgets  │
│                  ▲                                           │
│                  │ KernelEvent (the single source of truth)  │
│  Kernel    AgentKernel ── Transport ── runtime               │
├──────────────────────────────────────────────────────────────┤
│  Workbench services · actions · context keys · UI parts · SCM│
├──────────────────────────────────────────────────────────────┤
│  Support   model proxy · SSH · settings · keys · themes · i18n│
└──────────────────────────────────────────────────────────────┘
```

**Events are the only truth.** A runtime reports what happened; the UI consumes those events. Nothing else couples the two, so a runtime can be replaced, a message type added, or an IDE view extended without touching the other side.

<a id="development"></a>

## Development

Requires Flutter **3.47.5** (Dart SDK `^3.13.4`), plus Visual Studio 2022 build tools on Windows or Xcode 15+ on macOS.

```sh
flutter pub get
flutter run -d windows      # or macos / linux
```

Use a separate data folder while developing, so an installed copy is untouched:

```sh
AGILEGEEK_DATA_DIR=/path/to/empty-dir flutter run -d windows
```

Packaging:

```sh
dart run tool/build_windows.dart     # needs Inno Setup 6 or 7
dart run tool/build_macos.dart
flutter build linux --release && sh tool/package_linux_deb.sh
```

Checks:

```sh
flutter analyze --fatal-infos
flutter test test/<related-directory>
```

Commit messages follow `type(scope): summary`. UI uses the project's own widgets rather than stock Material or Cupertino ones. New strings go in both `lib/l10n/app_en.arb` and `app_zh.arb`.

## License

Released under the **GNU General Public License v3.0** (GPL-3.0-only). The editor and terminal packages under `packages/` are MIT-licensed; third-party components keep their own licenses. See [NOTICE.md](NOTICE.md).
