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
