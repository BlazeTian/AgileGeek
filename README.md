# AgileGeek · 灵动极客

<p align="center">
  <img src="site/brand/agilegeek-icon-256.png" width="120" alt="AgileGeek" />
</p>

<p align="center">
  <b>把智能体的工作，变成看得清、追得回、撤得掉的东西。</b><br />
  原生桌面应用，内置毫秒级响应的 IDE。
</p>

<p align="center">
  <img alt="Dart" src="https://img.shields.io/badge/Dart-3.13-0175C2?logo=dart&logoColor=white&style=flat-square" />
  <img alt="Flutter" src="https://img.shields.io/badge/Flutter-3.47-02569B?logo=flutter&logoColor=white&style=flat-square" />
  <img alt="Platform" src="https://img.shields.io/badge/Windows%20·%20macOS%20·%20Linux-3B82F6?style=flat-square" />
  <img alt="License" src="https://img.shields.io/badge/License-GPL--3.0--only-8B5CF6?style=flat-square" />
  <img alt="Version" src="https://img.shields.io/badge/Version-0.1.1-EAB308?style=flat-square" />
</p>

<p align="center">
  <a href="#理念">理念</a> ·
  <a href="#为什么选择它">为什么选择它</a> ·
  <a href="#功能">功能</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#架构">架构</a> ·
  <a href="#开发">开发</a>
</p>

---

<a id="理念"></a>

## 理念

**工具应该让工作变轻，而不是变重。**

我们每天都在和智能体协作。它读文件、跑命令、改代码——一次任务下来，几十上百个动作无声地流过。问题从来不是它不够能干，而是**你看不清它干了什么**：

- 五分钟前那个改动，滚上去还能找到吗？
- 它说"已修复"——改的是哪一行，依据是什么？
- 这个方案走不通，想让它换条路——要不要从头再来一遍？
- 它半夜跑完的任务，结果存在哪里？

现有的工作台大多是"终端套了个窗口"。灵动极客想得更远一点：**把智能体的每一步都变成可以停下来看、可以点开、可以退回的东西。**

<a id="为什么选择它"></a>

## 为什么选择它

<table>
<tr><td width="50%" valign="top">

**看得清**

- 每一次读取、搜索、命令折叠成单行，不再淹没对话
- 长任务自动分步，可以随时回看某一步
- 改动逐文件展示，看得见加了什么、删了什么

</td><td width="50%" valign="top">

**追得回**

- 每一步都有完整记录，包括当时的输出和结果
- 对话可以从任意一条消息重新开始
- 文件改动有独立检查点，不污染你的 Git 历史

</td></tr>
<tr><td valign="top">

**撤得掉**

- 单文件保留或撤销，精确到那一次修改
- 编辑已发送的消息并重发，可同时回滚文件
- 探索性任务失败，一键回到起点

</td><td valign="top">

**不将就**

- 原生绘制，启动快、占用低，不是网页壳子
- IDE 与对话同处一窗，改完立刻能看
- 不绑定任何单一模型供应商

</td></tr>
</table>

### 与常见方案的区别

| | 终端里的智能体 | 网页版 | 灵动极客 |
| --- | --- | --- | --- |
| 长任务阅读 | 滚动历史 | 有限 | 折叠成步骤 |
| 改动审阅 | 自己 `git diff` | 无 | 逐文件内置 |
| 回退 | 手动 | 无 | 一键 |
| IDE 协作 | 切窗口 | 无 | 同一窗口 |
| 启动速度 | 即时 | 数秒 | 即时 |

<a id="功能"></a>

## 功能

### 对话

| | |
| --- | --- |
| **为阅读而生的界面** | 读取、搜索、命令折叠成单行；长对话自动成步，随时回看 |
| **改动审查** | 逐文件展示修改，可保留、可撤销；检查点保存在应用数据目录，不写入仓库的 `.git` |
| **目标模式** | 输入 `/goal` 与想达成的事，它会持续工作到完成，进度显示在输入框上方 |
| **富文本输入** | 从编辑器复制的代码以「文件 + 行号」引用加入；粘贴的图片、拖入的文件停在句子中你放置的位置 |
| **排队与编辑** | 忙碌时消息自动排队，可排序、可取回修改；已发送的消息可编辑重发并选择是否回滚文件 |
| **子任务** | 子任务的过程可展开查看，实时跟进每一步 |
| **多路并行** | 最多四路对话并排，各自独立滚动、独立输入 |

### IDE

| | |
| --- | --- |
| **编辑器** | 原生实现，支持语法高亮、多光标、折叠、查找替换、小地图 |
| **语言服务** | 通过 LSP 接入补全、跳转、定义、引用、重命名、格式化、代码操作与诊断 |
| **终端** | 内置终端，支持分屏与多标签，键位可接管或透传 |
| **源代码管理** | 提交图、分支管理、部分提交、变更列表、冲突合并 |
| **主题** | 跟随 VS Code 主题；编辑器、对话与侧边栏统一配色 |

### 工程能力

- **任意模型**：添加兼容 Anthropic API、OpenAI Chat Completions 或 OpenAI Responses 的上游，本地代理负责协议转换，密钥存系统钥匙串
- **SSH 远程项目**：窗口留在本机，文件、Git、搜索、终端、语言服务全部跑在远程主机上
- **多窗口**：每个项目一个窗口，或把对话并排在同一窗口
- **通知**：任务需要你或完成时，通过系统通知、声音与角标提醒
- **便签**：随手记录想法，之后可一键交给智能体实施

<a id="快速开始"></a>

## 快速开始

1. 从 [Releases](https://github.com/BlazeTian/AgileGeek/releases) 下载安装包
2. 安装后打开，添加一个模型上游（设置 → 模型）
3. 选择项目文件夹，开始对话

### 系统要求

| 平台 | 要求 |
| --- | --- |
| Windows | Windows 10 及以上，x64 或 arm64 |
| macOS | macOS 12 及以上，Apple 芯片或 Intel |
| Linux | Ubuntu 20.04 及以上及其它 Debian 系发行版，x64 或 arm64 |

<a id="架构"></a>

## 架构

```text
┌──────────────────────────────────────────────────────────────┐
│  窗口层    Chat 窗口 · IDE 窗口 · Agent 窗口 · 便签窗口        │
├──────────────────────────────────────────────────────────────┤
│  对话层    ChatSession ── Transcript ── ChatItem ── 渲染       │
│                    ▲                                          │
│                    │ KernelEvent（唯一真相）                   │
│  内核层    AgentKernel ── Transport ── 运行时                  │
├──────────────────────────────────────────────────────────────┤
│  工作台    服务容器 · 命令注册表 · 上下文键 · 界面分块           │
│            SCM · Editor · Terminal · Search · LSP · Debug      │
├──────────────────────────────────────────────────────────────┤
│  支撑层    模型代理 · SSH 远程 · 设置 · 键位 · 主题 · 多语言     │
└──────────────────────────────────────────────────────────────┘
```

**事件是唯一的真相。** 运行时只上报发生了什么，界面只消费这些事件——两者之间没有别的耦合。因此替换运行时、新增消息类型、扩展 IDE 视图，都不需要改另一侧。

### 目录结构

```text
lib/
  chat/         对话：会话模型、消息渲染、输入框、侧面板、改动审查
  kernel/       运行时适配：事件模型、能力接口、各运行时的适配
  ide/          IDE：工作台服务、功能贡献、界面分块
  models/       模型上游、本地协议代理、密钥存储、用量与计费
  remote/       SSH 远程项目
  workspace/    项目、会话列表、多窗格、窗口
  settings/     设置文件与设置页
  theme/        主题、图标、字体
  stash/        便签
packages/
  agile_editor  Monaco 的 Flutter 移植：编辑器、语法高亮、主题、键位
  agile_xterm   xterm.js 的 Dart 移植
  agile_pty     POSIX forkpty / Windows ConPTY
  agile_remote  SSH 远程服务端与协议
  agile_agent   内置运行时
  agile_markdown 所见即所得 Markdown 编辑器
```

<a id="开发"></a>

## 开发

### 环境

- Flutter **3.47.5**（Dart SDK `^3.13.4`）
- Windows：Visual Studio 2022 生成工具 + Windows 10/11 SDK
- macOS：Xcode 15 及以上
- Linux：`libgtk-3-dev`、`liblzma-dev`、`clang`、`cmake`、`ninja-build`

### 从源码运行

```sh
flutter pub get
flutter run -d windows      # 或 macos / linux
```

开发时建议使用独立的数据目录，不影响已安装的版本：

```sh
AGILEGEEK_DATA_DIR=/path/to/empty-dir flutter run -d windows
```

### 打包

```sh
dart run tool/build_windows.dart     # 需要 Inno Setup 6 或 7
dart run tool/build_macos.dart
flutter build linux --release && sh tool/package_linux_deb.sh
```

产物写入 `build/installers/`。

### 检查与测试

```sh
flutter analyze --fatal-infos
dart format --output=none --set-exit-if-changed <改动的文件>
flutter test test/<相关目录>
```

完整测试较慢，只跑与改动相关的部分。

### 约定

- 提交信息用 `type(scope): summary`，如 `feat(chat): …`、`fix(ide): …`
- 界面统一用项目自己的组件，不直接用 Material / Cupertino 控件
- 新增文案同时更新 `lib/l10n/app_en.arb` 与 `app_zh.arb`
- 改代码前先读 [docs/](docs)，尤其是 `workbench-architecture.md`

## 许可证

以 **GNU General Public License v3.0**（GPL-3.0-only）发布。`packages/` 下的编辑器与终端相关包以 MIT 发布，第三方组件保留各自许可证，详见 [NOTICE.md](NOTICE.md)。
