<div align="center">

<img src="docs/assets/hero.png" alt="灵动极客 AgileGeek" width="100%" />

<br />

**为 Claude Code 而生的桌面工作台**

把终端里读不清的智能体会话，变成一个快、能折叠、可审阅的窗口。

<br />

[![Status](https://img.shields.io/badge/status-M0%20%C2%B7%20pre--alpha-8b5cf6?style=flat-square)](#roadmap)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2B-3b82f6?style=flat-square)](#requirements)
[![Tauri](https://img.shields.io/badge/Tauri-2-22d3ee?style=flat-square)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-2021-3b82f6?style=flat-square)](https://www.rust-lang.org)
[![License](https://img.shields.io/badge/license-proprietary-9aa3b2?style=flat-square)](#license)

[为什么](#why) · [特性](#features) · [开始使用](#getting-started) · [架构](#architecture) · [路线图](#roadmap)

</div>

---

<a id="why"></a>

## 为什么再做一次

终端很适合**运行**一个智能体，不适合**阅读**它。

长 diff 一滚就没了，二十分钟前的步骤再也找不回来，想看看它到底改了什么还得切到别的工具。我们每天在用 Claude Code，缺的从来不是能力，而是那扇窗。

**灵动极客**就是那扇窗：它不发明新的智能体，它跑你**已经装好的 Claude Code**——沿用你的 `settings.json`、`CLAUDE.md`、技能、MCP 服务器和 hooks——只把它的工作变成看得清、追得回、撤得掉的东西。

<details>
<summary><b>和别的工具有什么不同</b></summary>

<br />

| | 常见做法 | 灵动极客 |
|---|---|---|
| **智能体** | 自研一套，跟进缓慢 | 直接用你的 Claude Code，工具和生态同步升级 |
| **改动审查** | 看 `git diff`，或干脆信任 | 逐文件 / 逐 hunk 的 **Keep / Undo**，快照存在应用自己的目录，不污染仓库 |
| **长会话** | 一路滚到底 | 连续步骤自动折叠成一行，一场工作能收成一句「Worked for 4m 32s」 |
| **模型** | 绑死一家 | 任意 Anthropic 兼容端点，**DeepSeek 开箱即用**（已验证） |
| **体积** | 内嵌整个浏览器（150–300 MB） | 系统 WebView + Rust，目标 **< 15 MB** |
| **启动** | 数秒 | 目标 **< 500 ms**，编辑器按需加载 |

</details>

<a id="features"></a>

## 特性

> 下面是设计目标与当前进度。标 ✅ 的已经能跑，标 🚧 的在建，标 ◻️ 的排在后面。

**读得清**

- ✅ 流式输出、思考块、工具调用卡片 —— 每一帧都有归属，不会重复也不会丢
- ✅ 连续步骤折叠：`Read 3 files, ran 2 commands, thought for 12s`
- 🚧 Markdown / 代码高亮 / diff 卡片
- ◻️ 子代理对话独立展开

**改得准**

- ✅ 改动快照（内容寻址，BLAKE3）
- 🚧 **Keep / Undo**，逐文件与逐 hunk
- ◻️ 三方合并撤销：你在编辑器里改过的，不会被一并撤销
- ◻️ 冲突标记：宁可不撤，也不撤错

**跑得稳**

- ✅ 每个会话一个进程，Windows Job Object 管整棵进程树，退出不留孤儿
- ✅ 控制请求全部带超时 —— 一个没答的权限询问会让 CLI 永远卡住
- 🚧 空闲 10 分钟自动休眠，下一条消息 `--resume` 秒级唤醒
- ◻️ 崩溃恢复：进程没了，会话还在

**接得广**

- ✅ 自取 Claude Code：npm 镜像下载 → SHA-512 校验 → 解压 → 版本探测
- ✅ 原生 `claude.exe` 优先于 `.cmd` 转发壳（后者会让 `cmd.exe` 切断 `--settings` 的 JSON）
- 🚧 供应商管理：任意 Anthropic 兼容端点
- ◻️ OpenAI Chat / Responses 协议转换代理

<a id="getting-started"></a>

## 开始使用

### 环境要求

| | |
|---|---|
| 系统 | Windows 10 1809 或更新 |
| 运行时 | [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)（Win11 自带；Win10 多数已装） |
| 模型 | Anthropic 账号，或任意 Anthropic 兼容端点（如 DeepSeek） |

Claude Code **不需要**预先安装——首次启动时应用会自己取一份。

### 从源码构建

```bash
# 前置：Rust 1.80+、Node 20+
git clone https://github.com/BlazeTian/AgileGeek.git
cd AgileGeek

npm install
npm run build -w @agilegeek/desktop
cargo build --release
```

开发时热重载：

```bash
npm run dev -w @agilegeek/desktop   # 前端 dev server
cargo run -p agilegeek              # 窗口
```

<details>
<summary><b>国内网络加速</b>（Rust 官方源与 crates.io 都很慢）</summary>

<br />

`~/.cargo/config.toml`：

```toml
[source.crates-io]
replace-with = 'aliyun'

[source.aliyun]
registry = "sparse+https://mirrors.aliyun.com/crates.io-index/"

[target.x86_64-pc-windows-msvc]
linker = "rust-lld"
```

装 Rust 时同样指定镜像：

```powershell
$env:RUSTUP_DIST_SERVER="https://mirrors.aliyun.com/rustup"
```

npm 用 `registry.npmmirror.com`（项目默认已指向它）。

</details>

<a id="architecture"></a>

## 架构

```
┌──────────────────────────────────────────────────────────────┐
│  Window  ·  React 19 + TypeScript                            │
│  对话流 · 折叠 · 编辑器(按需) · 终端(按需)                    │
└───────────────────────────┬──────────────────────────────────┘
                            │  Tauri IPC（批量帧 + 二进制拉取）
┌───────────────────────────▼──────────────────────────────────┐
│  Shell  ·  Rust / tokio                                      │
│  会话进程 · 控制通道 · PTY · 文件快照 · CLI 获取              │
└───────────────────────────┬──────────────────────────────────┘
                            │  stream-json（一行一个 JSON）
┌───────────────────────────▼──────────────────────────────────┐
│  Claude Code CLI                                             │
│  claude -p --input-format stream-json --output-format ...     │
└──────────────────────────────────────────────────────────────┘
```

**分界的原则**：Rust 只做**必须在内核态完成**的事——起进程、开伪终端、读写文件、做同步屏障。
其余全部在 TypeScript 里：事件归约、折叠、投影、渲染。这样迭代界面不需要重编译。

### 三个关键决策

<table>
<tr><td width="33%" valign="top">

**事件溯源**

CLI 的每一帧变成带 `seq` 的事件，交给一个**纯函数** reducer。
流式增量和完整消息都落到同一个 item 上；重放历史走同一段代码。
断线、重启、回放——三种情况一套逻辑。

</td><td width="33%" valign="top">

**钩子做屏障**

想撤销一个改动，必须在**改动发生前**拿到原文。
监听输出流来不及——等你渲染完，文件早改好了。
所以注册 `PreToolUse` 钩子，它返回前 CLI 不会动手。

</td><td width="33%" valign="top">

**协议在边缘**

内部只用 Anthropic Messages 一种协议。
其它上游由本机代理翻译，Claude Code 永远只看见一种。

</td></tr>
</table>

### 目录

```
apps/desktop/          窗口：React、对话视图、编辑器、终端
packages/protocol/     Claude Code 写出来的类型，以及 shell 发给窗口的类型
packages/kernel/       对话作为纯 reducer：折叠、流式、重放
crates/claude-transport/   进程、stream-json、控制通道
crates/claude-launcher/    查找、下载、启动 CLI
crates/session-host/       每会话一进程：休眠、唤醒、崩溃恢复
crates/file-review/        改动快照与三方合并撤销
crates/pty-host/           伪终端
crates/app-core/           路径、设置、日志
src-tauri/             外壳：窗口、托盘、更新
```

<a id="roadmap"></a>

## 路线图

<table>
<tr><td width="25%" valign="top">

**M0 · 基座** ✅
- Tauri 外壳
- 协议类型
- 事件归约器
- CLI 传输层

</td><td width="25%" valign="top">

**M1 · 对话** 🚧
- CLI 获取 ✅
- 会话进程接入
- 流式渲染
- 会话历史

</td><td width="25%" valign="top">

**M2 · 控制面** ◻️
- 权限审批
- 提问与计划
- 中断
- 模式切换

</td><td width="25%" valign="top">

**M3 · 改动审查** ◻️
- Keep / Undo
- 逐 hunk
- 三方合并
- 冲突处理

</td></tr>
<tr><td valign="top">

**M4 · 编辑器** ◻️
- Monaco 按需加载
- 代码引用跳转
- 内联 diff

</td><td valign="top">

**M5 · 终端** ◻️
- ConPTY
- xterm + WebGL
- 二进制拉取通道

</td><td valign="top">

**M6 · 打磨** ◻️
- 托盘常驻
- 自动更新
- 中英文

</td><td valign="top">

**之后**

SSH 远程 · 手机端 · LSP · Git 面板 —— 均不在首版范围

</td></tr>
</table>

### 性能预算

| 指标 | 目标 | 当前 |
|---|---|---|
| 冷启动到首屏 | < 500 ms | 待测 |
| 安装包 | < 15 MB | 待测 |
| 空闲内存（仅聊天） | < 120 MB | 待测 |
| 首屏脚本（gzip） | < 100 KB | **71 KB** |

<a id="contributing"></a>

## 参与

这个仓库目前由作者独立开发，暂不接受未经讨论的 PR。
发现问题请开 Issue，附上复现步骤和你看到的**原始协议帧**（设置 → 诊断 → 导出日志）。

<a id="license"></a>

## 许可证

**专有软件，保留所有权利。**

Copyright © 2026 BlazeTian. 未经书面许可，不得复制、修改、分发或用于商业用途。

本项目与 Anthropic 无隶属关系，亦未获其背书。Claude 与 Claude Code 是 Anthropic 的商标。

<br />

<div align="center">
<sub>

**灵动极客** · AgileGeek — 让智能体的工作看得见

</sub>
</div>
