# AgileGeek · 灵动极客

<p align="center">
  <img src="site/brand/agilegeek-icon-256.png" width="120" alt="AgileGeek" />
</p>

<p align="center">
  <b>为 Claude Code 而生的桌面工作台</b><br />
  一个原生、快速、为阅读而设计的图形界面，内置毫秒级响应的 IDE。
</p>

<p align="center">
  <img alt="Dart" src="https://img.shields.io/badge/Dart-3.13-0175C2?logo=dart&logoColor=white&style=flat-square" />
  <img alt="Flutter" src="https://img.shields.io/badge/Flutter-3.47-02569B?logo=flutter&logoColor=white&style=flat-square" />
  <img alt="Platform" src="https://img.shields.io/badge/Windows%20·%20macOS%20·%20Linux-3B82F6?style=flat-square" />
  <img alt="License" src="https://img.shields.io/badge/License-GPL--3.0--only-8B5CF6?style=flat-square" />
  <img alt="Status" src="https://img.shields.io/badge/Status-0.1.0%20·%20pre--alpha-EAB308?style=flat-square" />
</p>

<!-- 语言：简体中文 · [English](README_EN.md) -->

<p align="center">
  <a href="#为什么">为什么</a> ·
  <a href="#功能">功能</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#架构">架构</a> ·
  <a href="#开发">开发</a> ·
  <a href="#许可证">许可证</a>
</p>

---

<a id="为什么"></a>

## 为什么

终端很适合**运行** Claude Code，不适合**阅读**它。

长 diff 一滚就出界，二十分钟前的步骤再也找不回来，想确认它到底改了什么还得切到另一个工具。我们每天都在用 Claude Code，缺的从来不是能力，而是那扇窗。

**灵动极客**就是那扇窗。它不发明新的智能体——Claude Code 才是智能体，它拥有工具、技能、插件、MCP 服务器、子智能体和 hooks。灵动极客运行你**已经装好的** Claude Code，沿用你的 `settings.json`、`CLAUDE.md`、技能与 MCP 配置，把它的工作变成看得清、追得回、撤得掉的东西。

<table>
<tr><td width="50%" valign="top">

**与其它的差别**

- 原生绘制，不套 Electron 外壳
- 对话与 IDE 在同一个窗口里协作
- 改动逐文件保留或撤销，检查点不进你的 `.git`
- 不绑定单一模型供应商

</td><td width="50%" valign="top">

**适合谁**

- 每天用 Claude Code 完成实际工作的开发者
- 需要回看、审阅、追溯每一次改动的人
- 想要「一个窗口解决全部」的人

</td></tr>
</table>

<a id="功能"></a>

## 功能

### 对话

| | |
| --- | --- |
| **为阅读而生的界面** | 文件读取、搜索、命令折叠成单行；长对话自动折叠成可回溯的步骤 |
| **改动审查** | Claude 的每一处修改逐文件展示，可保留、可撤销；检查点保存在应用数据目录，不写入仓库的 `.git` |
| **目标模式** | 输入 `/goal` 与你想达成的事，Claude 会持续工作直到达成，进度显示在输入框上方 |
| **富文本输入** | 从编辑器复制的代码以「文件 + 行号」引用加入；粘贴的图片、拖入的文件停在句子中你放置的位置 |
| **排队与编辑** | 忙碌时消息自动排队，可排序、可从队列取回修改；已发送的消息可编辑重发，并选择是否回滚文件 |
| **子智能体** | 子代理的工作过程可展开查看，实时跟进它的每一步 |

### IDE

| | |
| --- | --- |
| **编辑器** | 原生实现的编辑器，支持语法高亮、多光标、折叠、查找替换、小地图 |
| **语言服务** | 通过 LSP 接入补全、跳转、定义、引用、重命名、格式化、代码操作与诊断 |
| **终端** | 内置终端，支持分屏与多标签，键位可接管或透传 |
| **源代码管理** | 提交图、分支管理、部分提交、变更列表、冲突合并 |
| **主题** | 跟随 VS Code 主题；编辑器、对话与侧边栏统一配色 |

### 工作方式

- **任意模型**：可添加兼容 Anthropic API、OpenAI Chat Completions 或 OpenAI Responses 的上游，本地代理负责与 Claude Code 之间的协议转换。密钥保存在系统钥匙串。
- **SSH 远程项目**：窗口留在本机，文件、Git、搜索、终端、语言服务器和 Claude Code 全部跑在远程主机上。
- **多窗口与并排对话**：最多四路对话并排，每路独立滚动、独立输入。
- **通知**：智能体需要你或完成任务时，通过系统通知、声音与角标提醒；关闭窗口后仍可继续运行。
- **便签**：随手记录想法，之后可一键交给智能体实施。

<a id="快速开始"></a>

## 快速开始

### 使用发行版

1. 从 [Releases](https://github.com/BlazeTian/AgileGeek/releases) 下载对应平台的安装包。
2. 安装 [Claude Code](https://github.com/anthropics/claude-code)。
3. 打开灵动极客，选择一个项目文件夹即可开始。

> 首次启动会在 `%APPDATA%\agilegeek`（Windows）、`~/Library/Application Support/agilegeek`（macOS）或 `~/.config/agilegeek`（Linux）建立数据目录，与其它应用互不影响。

### 系统要求

| 平台 | 要求 |
| --- | --- |
| Windows | Windows 10 及以上，x64 或 arm64 |
| macOS | macOS 12 及以上，Apple 芯片或 Intel |
| Linux | Ubuntu 20.04 及以上及其它基于 Debian 的发行版，x64 或 arm64 |

<a id="架构"></a>

## 架构

```text
┌──────────────────────────────────────────────────────────────┐
│  窗口层    Chat 窗口 · IDE 窗口 · Agent 窗口 · 便签窗口        │
├──────────────────────────────────────────────────────────────┤
│  对话层    ChatSession ── Transcript ── ChatItem ── 渲染       │
│                    ▲                                          │
│                    │ KernelEvent（唯一真相）                   │
│  内核层    ClaudeCodeKernel ── Transport ── CLI / 内置引擎      │
├──────────────────────────────────────────────────────────────┤
│  工作台    服务容器 · 命令注册表 · 上下文键 · 界面分块           │
│            SCM · Editor · Terminal · Search · LSP · Debug      │
├──────────────────────────────────────────────────────────────┤
│  支撑层    模型代理 · SSH 远程 · 设置 · 键位 · 主题 · 多语言     │
└──────────────────────────────────────────────────────────────┘
```

内核只上报事件，界面只消费事件——两者之间没有别的耦合。因此替换运行时、新增消息类型、扩展 IDE 视图，都不需要改另一侧。

### 目录结构

```text
lib/
  chat/         对话：会话模型、消息渲染、输入框、侧面板、改动审查
  kernel/       agent 内核适配：事件模型、能力接口、Claude Code 适配、内置引擎
  ide/          IDE：工作台服务、各功能贡献、界面分块
  models/       模型上游、本地协议代理、密钥存储、用量与计费
  remote/       SSH 远程项目
  workspace/    项目、会话列表、多窗格、窗口
  settings/     设置文件（JSONC）与设置页
  theme/        主题、图标、字体
  stash/        便签
packages/
  agile_editor  Monaco 的 Flutter 移植：编辑器、语法高亮、主题、键位
  agile_xterm   xterm.js 的 Dart 移植
  agile_pty     POSIX forkpty / Windows ConPTY
  agile_remote  SSH 远程服务端与协议
  agile_agent   内置 agent 引擎
  agile_markdown 所见即所得 Markdown 编辑器
```

<a id="开发"></a>

## 开发

### 环境

- Flutter **3.47.5**（Dart SDK `^3.13.4`）
- Windows 需要 Visual Studio 2022 生成工具与 Windows 10/11 SDK
- macOS 需要 Xcode 15 及以上
- Linux 需要 `libgtk-3-dev`、`liblzma-dev`、`clang`、`cmake`、`ninja-build`

### 从源码运行

```sh
flutter pub get
flutter run -d windows      # 或 macos / linux
```

开发时建议使用独立的数据目录，避免影响已安装的版本：

```sh
AGILEGEEK_DATA_DIR=/path/to/empty-dir flutter run -d windows
```

### 打包

```sh
dart run tool/build_windows.dart     # 需要 Inno Setup 6
dart run tool/build_macos.dart
flutter build linux --release && sh tool/package_linux_deb.sh
dart run tool/build_remote_server.dart   # SSH 远程服务端
```

产物写入 `build/installers/`。

### 测试与检查

```sh
flutter analyze --fatal-infos
dart format --output=none --set-exit-if-changed <改动的文件>
flutter test test/<相关目录>
```

完整测试套件较慢，请只运行与改动相关的测试。

### 约定

- 提交信息使用 `type(scope): summary`，例如 `feat(chat): …`、`fix(ide): …`
- 界面统一使用项目自己的组件，不直接使用 Material / Cupertino 控件
- 新增文案同时更新 `lib/l10n/app_en.arb` 与 `app_zh.arb`
- 改动前先读 [docs/](docs)，尤其是 `workbench-architecture.md`

<a id="许可证"></a>

## 许可证

本项目以 **GNU General Public License v3.0**（GPL-3.0-only）发布，完整文本见 [LICENSE](LICENSE)。

`packages/` 下的编辑器与终端相关包（`agile_editor`、`agile_xterm`、`agile_pty`、`agile_conpty`、`agile_iroh`）以 MIT 许可证发布，第三方组件保留各自的许可证，说明见 [NOTICE.md](NOTICE.md)。

> 本项目的部分代码源自开源项目 [BaoCode](https://github.com/baocode-dev/baocode)（GPL-3.0-only），原始版权归其作者所有，署名与许可条款见 [NOTICE.md](NOTICE.md)。

灵动极客是独立项目，与 Anthropic 及上述开源项目的维护者均无隶属关系，也未获其背书。Claude 与 Claude Code 是 Anthropic 的商标。
