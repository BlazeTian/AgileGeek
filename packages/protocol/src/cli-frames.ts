import { readContent, type ContentBlock, type MessageContent, type Usage } from './content.js';
import { asArray, asNumber, asObject, asString, type JsonObject } from './json.js';

/**
 * The frames Claude Code writes on stdout with
 * `--output-format stream-json`, one JSON object a line.
 *
 * The protocol is not a published contract: unknown `type`s are kept as
 * `UnknownFrame` rather than rejected, and every reader below is lenient.
 */
export type CliFrame =
  | SystemFrame
  | AssistantFrame
  | UserFrame
  | ResultFrame
  | StreamEventFrame
  | ControlRequestFrame
  | ControlResponseFrame
  | ControlCancelRequestFrame
  | RateLimitFrame
  | CommandLifecycleFrame
  | PromptSuggestionFrame
  | TombstoneFrame
  | UnknownFrame;

export interface UnknownFrame {
  type: string;
  [key: string]: unknown;
}

// --- System -----------------------------------------------------------------

export interface SystemInitFrame {
  type: 'system';
  subtype: 'init';
  cwd: string;
  tools: string[];
  mcp_servers: { name: string; status: string }[];
  model: string;
  permissionMode: string;
  slash_commands?: string[];
  apiKeySource?: string;
  claude_code_version?: string;
  output_style?: string;
  agents?: string[];
  skills?: string[];
  plugins?: { name: string; path: string }[];
  /** What this CLI can do, e.g. `interrupt_send_now_v1`. Prefer these to version checks. */
  capabilities?: string[];
  memory_paths?: { auto?: string };
  effort?: string | null;
  [key: string]: unknown;
}

export interface SystemStatusFrame {
  type: 'system';
  subtype: 'status';
  status: 'requesting' | 'compacting' | string | null;
  permissionMode?: string;
  [key: string]: unknown;
}

export interface CompactBoundaryFrame {
  type: 'system';
  subtype: 'compact_boundary';
  content: string;
  compactMetadata?: {
    trigger?: 'auto' | 'manual' | 'clear';
    preTokens?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface SessionStateFrame {
  type: 'system';
  subtype: 'session_state_changed';
  state: 'idle' | 'running' | 'requires_action';
  [key: string]: unknown;
}

export interface InformationalFrame {
  type: 'system';
  subtype: 'informational';
  level: 'info' | 'notice' | 'warning' | 'error';
  content: string;
  [key: string]: unknown;
}

/** Any `system` frame: init, status, compaction, session state, or something newer. */
export interface SystemFrame {
  type: 'system';
  subtype: string;
  [key: string]: unknown;
}

// --- Messages ----------------------------------------------------------------

export interface AssistantMessage {
  id?: string;
  type?: 'message';
  role: 'assistant';
  model?: string;
  content: ContentBlock[];
  stop_reason?: string | null;
  stop_sequence?: string | null;
  usage?: Usage;
}

export interface AssistantFrame {
  type: 'assistant';
  message: AssistantMessage;
  /** The tool call this message belongs to, for a subagent's messages. */
  parent_tool_use_id: string | null;
  uuid?: string;
  session_id?: string;
  /** Set when the CLI itself failed: `api_error`, `rate_limit`, … */
  error?: string;
  /** For a subagent's messages. */
  agentId?: string;
  isSidechain?: boolean;
}

export interface UserFrame {
  type: 'user';
  message: {
    role: 'user';
    content: MessageContent;
  };
  parent_tool_use_id: string | null;
  uuid?: string;
  session_id?: string;
  /** What the host is told of a tool's result, for rendering. */
  tool_use_result?: unknown;
  isMeta?: boolean;
  isReplay?: boolean;
  isSidechain?: boolean;
  agentId?: string;
}

export interface ResultFrame {
  type: 'result';
  subtype: 'success' | 'error_during_execution' | 'error_max_turns' | string;
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result: string;
  stop_reason: string | null;
  session_id?: string;
  total_cost_usd?: number;
  usage?: Usage;
  modelUsage?: Record<string, JsonObject>;
  permission_denials?: JsonObject[];
  [key: string]: unknown;
}

// --- Streaming ---------------------------------------------------------------

/** One event of the Messages API's SSE stream, passed through. */
export interface StreamEventFrame {
  type: 'stream_event';
  event: JsonObject;
  parent_tool_use_id: string | null;
  uuid?: string;
}

// --- Control -----------------------------------------------------------------

export interface ControlRequestFrame {
  type: 'control_request';
  request_id: string;
  request: JsonObject;
}

export interface ControlResponseFrame {
  type: 'control_response';
  response: {
    subtype: 'success' | 'error';
    request_id: string;
    response?: JsonObject;
    error?: string;
  };
}

export interface ControlCancelRequestFrame {
  type: 'control_cancel_request';
  request_id: string;
}

// --- Misc --------------------------------------------------------------------

export interface RateLimitFrame {
  type: 'rate_limit_event';
  [key: string]: unknown;
}

/** A queued message the user sent: started, taken up, cancelled. */
export interface CommandLifecycleFrame {
  type: 'command_lifecycle';
  command_uuid: string;
  state: 'started' | 'cancelled' | 'completed';
}

export interface PromptSuggestionFrame {
  type: 'prompt_suggestion';
  suggestion: string;
  uuid?: string;
}

/** A message that went away (an edit rewound it). */
export interface TombstoneFrame {
  type: 'tombstone';
  uuid?: string;
  message_uuid?: string;
  [key: string]: unknown;
}

// --- Reading -----------------------------------------------------------------

/**
 * Reads one line as a frame. Returns null for what is not a JSON object,
 * so a line of diagnostics on stdout cannot stop the session.
 */
export function readFrame(line: string): CliFrame | null {
  const text = line.trim();
  if (text.length === 0) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    return null;
  }
  if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) {
    return null;
  }
  const frame = decoded as JsonObject;
  if (typeof frame.type !== 'string') return null;
  return frame as unknown as CliFrame;
}

/** Whether this build knows the frame's shape. */
export function isKnownFrame(frame: CliFrame): boolean {
  switch (frame.type) {
    case 'system':
    case 'assistant':
    case 'user':
    case 'result':
    case 'stream_event':
    case 'control_request':
    case 'control_response':
    case 'control_cancel_request':
    case 'rate_limit_event':
    case 'command_lifecycle':
    case 'prompt_suggestion':
    case 'tombstone':
      return true;
    default:
      return false;
  }
}

/** The `system` frame's subtype, or null. */
export function systemSubtype(frame: CliFrame): string | null {
  return frame.type === 'system' ? asString((frame as SystemFrame).subtype) : null;
}

/** The usage of a result frame, its numbers read leniently. */
export function resultUsage(frame: ResultFrame): Usage {
  const usage = asObject(frame.usage);
  return {
    input_tokens: asNumber(usage.input_tokens) ?? 0,
    output_tokens: asNumber(usage.output_tokens) ?? 0,
    cache_creation_input_tokens: asNumber(usage.cache_creation_input_tokens) ?? 0,
    cache_read_input_tokens: asNumber(usage.cache_read_input_tokens) ?? 0,
  };
}

/** The messages of a frame, for the frames that carry one. */
export function frameMessages(frame: CliFrame): unknown[] {
  if (frame.type === 'assistant') {
    return readContent((frame as AssistantFrame).message?.content);
  }
  if (frame.type === 'user') {
    return readContent((frame as UserFrame).message?.content);
  }
  return [];
}

/** The tool-use ids a user frame answers, for reordering results. */
export function toolResultIds(frame: UserFrame): string[] {
  return readContent(frame.message?.content)
    .filter((block) => block.type === 'tool_result')
    .map((block) => (block as { tool_use_id: string }).tool_use_id);
}

/** The tool calls of an assistant frame. */
export function toolUsesOf(frame: AssistantFrame): { id: string; name: string; input: JsonObject }[] {
  return readContent(frame.message?.content)
    .filter((block) => block.type === 'tool_use')
    .map((block) => {
      const call = block as { id: string; name: string; input: unknown };
      return { id: call.id, name: call.name, input: asObject(call.input) };
    });
}

/** The servers an init frame reports. */
export function initServers(frame: SystemInitFrame): { name: string; status: string }[] {
  return asArray(frame.mcp_servers).map((raw) => {
    const server = asObject(raw);
    return { name: asString(server.name) ?? '', status: asString(server.status) ?? 'unknown' };
  });
}
