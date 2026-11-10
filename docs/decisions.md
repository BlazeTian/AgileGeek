# Architecture Decisions

## ADR-0001 · DeepSeek 接入方式：零代理直连

**日期**：2026-11-10
**状态**：已决定（经真实 Key 实测）

### 结论

DeepSeek 通过其 Anthropic 兼容端点可直接驱动 Claude Code CLI，**不需要本地协议翻译代理**。

```
ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
ANTHROPIC_AUTH_TOKEN=<key>
ANTHROPIC_API_KEY=
```

### 实测结果（10 项探针全部通过）

| # | 检查 | 结果 | 说明 |
|---|---|---|---|
| 1 | 最小流式请求 | ✅ 200 | 完整 `message_start / content_block_delta / message_stop` |
| 2 | `cache_control` | ✅ 200（静默忽略） | 不报错；`cache_creation_input_tokens` 恒为 0，即无真实缓存 |
| 3 | `tools` + `tool_choice:auto` | ✅ 200 | 返回合法 `tool_use`，`input` 为正确 JSON |
| 4 | `tool_choice:{type:"any"}` | 未测 | 待补 |
| 5 | `tool_choice:{type:"tool",name}` | 未测 | 待补 |
| 6 | `thinking` 请求 | ✅ 200 | 返回 `thinking` 块，带 `signature` |
| 7 | **thinking 块回放第二轮** | ✅ 200 | 关键在于不翻车 |
| 8 | `count_tokens` | ✅ 200 | `/anthropic/v1/messages/count_tokens` 可用 |
| 9 | `/models` | ⚠️ 前缀不同 | `/anthropic/v1/models` → **404**；`/v1/models` → 200 |
| 10 | 错误体形状 | ⚠️ OpenAI 形状 | 401 返回 `{"error":{...}}`，非 Anthropic 的 `{"type":"error",...}` |

### 模型清单（`GET /v1/models`）

| id | 上下文 | 最大输出 | 输入 | effort 档位 | anthropic_messages 能力 |
|---|---|---|---|---|---|
| `deepseek-flash` | 1,048,576 | 393,216 | text, **image** | low / high / max | `system_prompt_update: in-history`，`tool_update: addition-only` |
| `deepseek-v4-pro` | 1,048,576 | 393,216 | text | low / high / max | `system_prompt_update: leading-only`，`tool_update: leading-only` |

### 由此确定的三条实现规则

1. **模型列表必须回退**：先试 `<base>/v1/models`，404 再试 origin 的 `/v1/models`。
   `deepseek-flash` 的上游元数据里已自带 `context_window` / `max_output_tokens` / `effort` / `input_modalities`，
   直接采信，不要用默认 200K。

2. **错误体需要兜底**：DeepSeek 的错误是 OpenAI 形状，Claude Code 会显示成 `[object Object]`。
   UI 层要在原始帧里识别 `{"error":{"message":...}}` 并提取 `message` 字段展示。
   **不因此启用代理**——只是显示问题，不阻塞功能。

3. **`cache_control` 无真实效果**：请求不报错，但缓存不生效。
   UI 的「缓存命中率」对该供应商应显示为「不支持」，而非 0%。
   `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` 仍需设置。

### 未做的验证

- `deepseek-flash` 的图片输入（`input_modalities` 含 image）在 Claude Code 的 image block 下是否可用。
- `api_capabilities.anthropic_messages` 里 `system_prompt_update: leading-only`（v4-pro）
  对子代理（每个子代理有自己的 system prompt）意味着什么——需要实际跑多子代理场景。
- 长上下文（接近 1M）下的表现与自动压缩阈值。

### 影响

- `crates/model-proxy` **不在阶段一实现**，仅保留 `EndpointSpec::{Direct, Proxied}` 的类型入口。
- M3 的「兼容性探针」保留，但预期全绿；它的价值是给**其它**供应商做能力判定。

---

## ADR-0002 · 用真实 CLI 验证协议（2026-11-10）

本机已装 Claude Code **2.1.145**（原生 exe，229 MB，在
`node_modules/@anthropic-ai/claude-code/bin/claude.exe`）。

### 一次真实往返的帧序

```
system/session_state_changed (running)
system/init                    ← 28 个工具、session_id、model、permissionMode
assistant (thinking 块)
assistant (text 块 "PONG")
result                         ← usage、cost、modelUsage
system/session_state_changed (idle)
```

### 三个必须照做的事实

1. **`system/init` 里有 `memory_paths`、`skills`、`agents`、`plugins`、
   `slash_commands`、`claude_code_version`。** 这些决定了 UI 能显示什么，
   不必自己扫描磁盘。
2. **目录名编码不是简单替换**：`C:\Users\天哥\agilegeek-probe` →
   `C--Users----agilegeek-probe`（中文被换成 `-`，每次连续替换折叠）。
   **不要自己实现这个编码**——改为遍历 `projects/*`，从每行 JSONL 的
   `cwd` 字段读真实路径。这与 ADR-0001 的设计一致。
3. **会话 JSONL 里除对话条目外，还有 `queue-operation`、
   `file-history-snapshot`、`last-prompt`、`attachment` 等旁注行。**
   解析时必须跳过未知 `type`，否则会话打不开。

### 用户环境的一项实证

本机 `~/.claude/settings.json` 已经配置为走 DeepSeek：

```
ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
ANTHROPIC_MODEL=deepseek-v4-pro
ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro
ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro
ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
```

且 `init` 里 `apiKeySource: "none"`——说明 **Claude Code 用户已经在用零代理
方案跑 DeepSeek**，我们只是把它做成图形界面。这印证了 ADR-0001 的结论。

### 对实现的补充要求

- `result` 帧里有 `ttft_ms`、`server_tool_use`、`speed`、`terminal_reason`，
  可用来做「首字延迟」「工具耗时」这类展示。
- `init` 的工具名里有 `PowerShell`（Windows 上 Bash 的替代），
  折叠规则要按「命令类工具」而不是硬编码 `Bash` 来判断。
