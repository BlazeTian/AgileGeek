import type { CliFrame, JsonObject, Usage } from '@agilegeek/protocol';
import {
  asArray,
  asNumber,
  asObject,
  asString,
  readContent,
  type AssistantFrame,
  type ContentBlock,
  type ResultFrame,
  type SystemFrame,
  type UserFrame,
} from '@agilegeek/protocol';
import type {
  AgentItem,
  AssistantTextItem,
  BackgroundTask,
  ChatItem,
  FileEditItem,
  ImageRef,
  NoticeItem,
  PendingInteraction,
  PlanItem,
  QueuedMessage,
  ThinkingItem,
  ToolCallItem,
  Turn,
  UserMessageItem,
} from './items.js';

/**
 * The conversation as one pure function of the frames seen so far.
 *
 * Frames are applied in order and the result is idempotent: the CLI sends
 * a token-level delta stream and then the whole message, and both describe
 * the same item, so `apply` replaces rather than appends. Replaying a
 * session's JSONL through the same reducer gives the same conversation as
 * watching it live, which is what makes history and live view one code path.
 */
export interface TranscriptState {
  /** The items in display order. */
  items: ChatItem[];
  /** The item ids, for lookup, in the same order as `items`. */
  index: Map<string, ChatItem>;
  /** What the user sent that has not been taken up. */
  queued: QueuedMessage[];
  /** Control requests waiting for an answer. */
  pending: PendingInteraction[];
  turns: Turn[];
  activeTurnId: string | null;
  /** What the CLI says it is doing: waiting, compacting. */
  activity: 'waiting' | 'compacting' | null;
  /** Files changed in this session, and whether each can be undone. */
  edits: Map<string, FileEditItem>;
  plan: PlanItem | null;
  tasks: BackgroundTask[];
  /** The model of the current session, and what it can do. */
  model: string | null;
  permissionMode: string | null;
  /** The context window's size, as the CLI reports it. */
  contextWindow: number | null;
  lastUsage: Usage | null;
  totalCostUsd: number;
  /** A suggested next prompt, from the CLI. */
  suggestion: string | null;
  /** The conversation's title, once the CLI names it. */
  title: string | null;
  /** The message whose stream is open, named by its last `message_start`. */
  openStreamId: string | null;
}

/** A fresh, empty conversation. */
export function emptyTranscript(): TranscriptState {
  return {
    items: [],
    index: new Map(),
    queued: [],
    pending: [],
    turns: [],
    activeTurnId: null,
    activity: null,
    edits: new Map(),
    plan: null,
    tasks: [],
    model: null,
    permissionMode: null,
    contextWindow: null,
    lastUsage: null,
    totalCostUsd: 0,
    suggestion: null,
    title: null,
    openStreamId: null,
  };
}

/**
 * Applies one frame. Returns the same object, mutated: the caller holds
 * the only reference, and copying a long conversation per token would be
 * the whole cost of the render.
 */
export function applyFrame(state: TranscriptState, frame: CliFrame, seq: number): TranscriptState {
  switch (frame.type) {
    case 'system':
      applySystem(state, frame as SystemFrame, seq);
      break;
    case 'stream_event':
      applyStreamEvent(state, frame as never, seq);
      break;
    case 'assistant':
      applyAssistant(state, frame as AssistantFrame, seq);
      break;
    case 'user':
      applyUser(state, frame as UserFrame, seq);
      break;
    case 'result':
      applyResult(state, frame as ResultFrame);
      break;
    case 'prompt_suggestion':
      state.suggestion = asString((frame as { suggestion?: unknown }).suggestion);
      break;
    case 'control_request':
      applyControlRequest(state, frame as never);
      break;
    case 'control_cancel_request':
      applyControlCancel(state, frame as never);
      break;
    default:
      // Unknown and uninteresting frames (rate limits, tombstones, command
      // lifecycle) are kept out of the conversation rather than dropped by
      // the reader: a newer CLI may put more in them.
      break;
  }
  return state;
}

// --- System ------------------------------------------------------------------

function applySystem(state: TranscriptState, frame: SystemFrame, seq: number): void {
  const subtype = asString(frame.subtype) ?? '';
  switch (subtype) {
    case 'init': {
      state.model = asString(frame.model) ?? state.model;
      state.permissionMode = asString(frame.permissionMode) ?? state.permissionMode;
      break;
    }
    case 'status': {
      const status = asString(frame.status);
      state.activity =
        status === 'compacting' ? 'compacting' : status === 'requesting' ? null : state.activity;
      {
        const mode = asString(frame.permissionMode);
        if (mode !== null) state.permissionMode = mode;
      }
      break;
    }
    case 'compact_boundary': {
      const item: NoticeItem = {
        id: `compact:${seq}`,
        turnId: state.activeTurnId,
        parentToolUseId: null,
        kind: 'notice',
        level: 'info',
        text: asString(frame.content) ?? 'Conversation compacted',
        at: Date.now(),
      };
      upsert(state, item);
      state.activity = null;
      break;
    }
    case 'informational': {
      const level = asString(frame.level) ?? 'info';
      const item: NoticeItem = {
        id: `info:${seq}`,
        turnId: state.activeTurnId,
        parentToolUseId: null,
        kind: 'notice',
        level: level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'notice',
        text: asString(frame.content) ?? '',
        at: Date.now(),
      };
      upsert(state, item);
      break;
    }
    case 'session_state_changed': {
      // `requires_action` is the CLI asking the user something, which the
      // pending interactions already say.
      break;
    }
    case 'session_title_changed': {
      const title = asString(frame.title);
      if (title !== null) state.title = title;
      break;
    }
    default:
      break;
  }
}

// --- Streaming -----------------------------------------------------------------

/** An item id for a block of a message: the message's id and the block's index. */
function blockId(messageId: string, index: number): string {
  return `${messageId}:${index}`;
}

function applyStreamEvent(
  state: TranscriptState,
  frame: { event: JsonObject; parent_tool_use_id?: string | null },
  seq: number,
): void {
  const event = asObject(frame.event);
  const type = asString(event.type);
  const parent = asString(frame.parent_tool_use_id);

  switch (type) {
    case 'message_start': {
      const message = asObject(event.message);
      const id = asString(message.id) ?? `msg:${seq}`;
      state.model = asString(message.model) ?? state.model;
      ensureTurn(state, id);
      // A new message: remember its id under the turn, for deltas that name
      // only the index.
      state.openStreamId = id;
      break;
    }
    case 'content_block_start': {
      const index = asNumber(event.index) ?? 0;
      const block = asObject(event.content_block);
      const kind = asString(block.type);
      const messageId = currentMessageId(state);
      if (messageId === null) break;
      const id = kind === 'tool_use' ? (asString(block.id) ?? blockId(messageId, index)) : blockId(messageId, index);
      if (kind === 'text') {
        upsert(state, {
          id,
          turnId: state.activeTurnId,
          parentToolUseId: parent,
          kind: 'assistantText',
          text: asString(block.text) ?? '',
          streaming: true,
          model: state.model,
          at: Date.now(),
        });
      } else if (kind === 'thinking') {
        upsert(state, {
          id,
          turnId: state.activeTurnId,
          parentToolUseId: parent,
          kind: 'thinking',
          text: asString(block.thinking) ?? '',
          streaming: true,
          durationMs: null,
          at: Date.now(),
        });
      } else if (kind === 'tool_use') {
        upsert(state, {
          id,
          turnId: state.activeTurnId,
          parentToolUseId: parent,
          kind: 'toolCall',
          toolUseId: asString(block.id) ?? id,
          name: asString(block.name) ?? 'unknown',
          input: asObject(block.input),
          result: null,
          state: 'running',
          startedAt: Date.now(),
          endedAt: null,
          agentId: null,
        });
      }
      break;
    }
    case 'content_block_delta': {
      const index = asNumber(event.index) ?? 0;
      const delta = asObject(event.delta);
      const messageId = currentMessageId(state);
      if (messageId === null) break;
      const id = blockId(messageId, index);
      const item = state.index.get(id);
      const deltaType = asString(delta.type);
      if (item?.kind === 'assistantText' && deltaType === 'text_delta') {
        item.text += asString(delta.text) ?? '';
      } else if (item?.kind === 'thinking' && deltaType === 'thinking_delta') {
        item.text += asString(delta.thinking) ?? '';
      } else if (item?.kind === 'toolCall' && deltaType === 'input_json_delta') {
        // Partial JSON: kept as it comes, parsed when the block stops.
        const partial = asString(delta.partial_json) ?? '';
        (item as ToolCallItem & { _json?: string })._json =
          ((item as { _json?: string })._json ?? '') + partial;
      }
      break;
    }
    case 'message_stop': {
      state.openStreamId = null;
      break;
    }
    case 'content_block_stop': {
      const index = asNumber(event.index) ?? 0;
      const messageId = currentMessageId(state);
      if (messageId === null) break;
      const item = state.index.get(blockId(messageId, index));
      if (item?.kind === 'assistantText') item.streaming = false;
      else if (item?.kind === 'thinking') item.streaming = false;
      else if (item?.kind === 'toolCall') {
        const json = (item as { _json?: string })._json;
        if (json !== undefined && json.length > 0) {
          try {
            item.input = asObject(JSON.parse(json));
          } catch {
            // A partial that did not parse: the full message will say.
          }
          delete (item as { _json?: string })._json;
        }
      }
      break;
    }
    default:
      break;
  }
}

/**
 * The id of the message whose stream is open, from the last `message_start`.
 * Held per transcript, not module-wide: several sessions stream at once.
 */
function currentMessageId(state: TranscriptState): string | null {
  return state.openStreamId;
}

// --- Complete messages ------------------------------------------------------------

function applyAssistant(state: TranscriptState, frame: AssistantFrame, seq: number): void {
  const message = asObject((frame as unknown as JsonObject).message);
  const messageId = asString(message.id) ?? `assistant:${seq}`;
  const parent = asString((frame as unknown as JsonObject).parent_tool_use_id);
  const blocks = readContent(message.content);

  ensureTurn(state, `turn:${messageId}`);

  blocks.forEach((block, index) => {
    applyAssistantBlock(state, block as never, messageId, index, parent, seq);
  });

  // The stream is done with this message; its deltas must stop landing.
  if (state.openStreamId === messageId) state.openStreamId = null;
  settleStreaming(state, messageId);
}

function applyAssistantBlock(
  state: TranscriptState,
  block: ContentBlock & Record<string, unknown>,
  messageId: string,
  index: number,
  parent: string | null,
  seq: number,
): void {
  switch (block.type) {
    case 'text': {
      const id = blockId(messageId, index);
      const existing = state.index.get(id);
      upsert(state, {
        id,
        turnId: state.activeTurnId,
        parentToolUseId: parent,
        kind: 'assistantText',
        text: String(block.text ?? ''),
        streaming: false,
        model: state.model,
        at: existing?.kind === 'assistantText' ? existing.at : Date.now(),
      });
      break;
    }
    case 'thinking': {
      const id = blockId(messageId, index);
      const existing = state.index.get(id);
      upsert(state, {
        id,
        turnId: state.activeTurnId,
        parentToolUseId: parent,
        kind: 'thinking',
        text: String(block.thinking ?? ''),
        streaming: false,
        durationMs: existing?.kind === 'thinking' ? existing.durationMs : null,
        at: existing?.kind === 'thinking' ? existing.at : Date.now(),
      });
      break;
    }
    case 'tool_use': {
      const use = block as unknown as { id?: unknown; name?: unknown; input?: unknown };
      const id = String(use.id ?? blockId(messageId, index));
      const existing = state.index.get(id);
      const call: ToolCallItem = existing?.kind === 'toolCall'
        ? { ...existing, name: String(use.name ?? existing.name), input: asObject(use.input) }
        : {
            id,
            turnId: state.activeTurnId,
            parentToolUseId: parent,
            kind: 'toolCall',
            toolUseId: id,
            name: String(use.name ?? 'unknown'),
            input: asObject(use.input),
            result: null,
            state: 'running',
            startedAt: Date.now(),
            endedAt: null,
            agentId: null,
          };
      upsert(state, call);
      break;
    }
    default:
      break;
  }
}

/** Ends streaming on every item of a message, whether or not its stop arrived. */
function settleStreaming(state: TranscriptState, messageId: string): void {
  const prefix = `${messageId}:`;
  for (const item of state.items) {
    if (item.id.startsWith(prefix)) {
      if (item.kind === 'assistantText' || item.kind === 'thinking') item.streaming = false;
    }
  }
}

function applyUser(state: TranscriptState, frame: UserFrame, seq: number): void {
  const parent = asString((frame as unknown as JsonObject).parent_tool_use_id);
  const blocks = readContent(asObject((frame as unknown as JsonObject).message).content);
  const toolResults = blocks.filter((block) => block.type === 'tool_result');

  for (const block of toolResults) {
    const result = block as unknown as {
      tool_use_id?: unknown;
      content?: unknown;
      is_error?: unknown;
    };
    const call = state.index.get(String(result.tool_use_id ?? ''));
    if (call?.kind !== 'toolCall') continue;
    const content = result.content;
    const text = typeof content === 'string'
      ? content
      : asArray(content)
          .map((part) => asString(asObject(part).text) ?? '')
          .join('\n');
    call.result = {
      content: text,
      isError: result.is_error === true,
      raw: (frame as { tool_use_result?: unknown }).tool_use_result,
    };
    call.state = result.is_error === true ? 'error' : 'done';
    call.endedAt = Date.now();
  }

  // A user frame with no result is a message the user typed (a replay, or
  // one taken up from the queue): shown as their message.
  if (toolResults.length === 0 && !(frame as { isMeta?: boolean }).isMeta) {
    const text = blocks
      .filter((block) => block.type === 'text')
      .map((block) => (block as { text: string }).text)
      .join('\n')
      .trim();
    if (text.length > 0 && !text.startsWith('<')) {
      const id = asString((frame as { uuid?: unknown }).uuid) ?? `user:${seq}`;
      const images: ImageRef[] = blocks
        .filter((block) => block.type === 'image')
        .map((block) => {
          const source = (block as { source?: JsonObject }).source ?? {};
          return {
            mediaType: asString(source.media_type) ?? 'image/png',
            data: asString(source.data) ?? asString(source.url) ?? '',
          };
        });
      // Taken up: no longer waiting in the queue.
      state.queued = state.queued.filter((queued) => queued.uuid !== id);
      upsert(state, {
        id,
        turnId: `turn:${id}`,
        parentToolUseId: parent,
        kind: 'user',
        text,
        images,
        queued: false,
        priority: 'later',
        own: false,
        at: Date.now(),
      });
    }
  }
}

function applyResult(state: TranscriptState, frame: ResultFrame): void {
  const turnId = state.activeTurnId;
  if (turnId !== null) {
    const turn = state.turns.find((candidate) => candidate.id === turnId);
    if (turn !== undefined && turn.endedAt === null) {
      turn.endedAt = Date.now();
      turn.usage = usageOf(frame);
      turn.requests = asNumber(frame.num_turns) ?? turn.requests;
      turn.apiDurationMs = asNumber(frame.duration_api_ms) ?? turn.apiDurationMs;
      turn.reason = frame.is_error === true ? 'error' : 'end_turn';
      turn.error = frame.is_error === true ? (asString(frame.result) ?? null) : null;
    }
  }
  state.activeTurnId = null;
  state.activity = null;
  state.lastUsage = usageOf(frame);
  const cost = asNumber(frame.total_cost_usd);
  if (cost !== null) state.totalCostUsd = cost;

  if (frame.is_error === true) {
    upsert(state, {
      id: `error:${Date.now()}`,
      turnId,
      parentToolUseId: null,
      kind: 'notice',
      level: 'error',
      text: asString(frame.result) ?? 'The turn failed.',
      at: Date.now(),
    });
  }
}

function usageOf(frame: ResultFrame): Usage {
  const usage = asObject(frame.usage);
  return {
    input_tokens: asNumber(usage.input_tokens) ?? 0,
    output_tokens: asNumber(usage.output_tokens) ?? 0,
    cache_creation_input_tokens: asNumber(usage.cache_creation_input_tokens) ?? 0,
    cache_read_input_tokens: asNumber(usage.cache_read_input_tokens) ?? 0,
  };
}

// --- Interactions ------------------------------------------------------------------

function applyControlRequest(
  state: TranscriptState,
  frame: { request_id: string; request: JsonObject },
): void {
  const request = asObject(frame.request);
  if (asString(request.subtype) === 'can_use_tool') {
    state.pending = [
      ...state.pending.filter((pending) => pending.requestId !== frame.request_id),
      {
        kind: 'permission',
        requestId: frame.request_id,
        toolName: asString(request.tool_name) ?? 'tool',
        input: asObject(request.input),
        description: asString(request.description),
        suggestions: asArray(request.permission_suggestions),
        at: Date.now(),
      },
    ];
  }
}

function applyControlCancel(
  state: TranscriptState,
  frame: { request_id: string },
): void {
  state.pending = state.pending.filter((pending) => pending.requestId !== frame.request_id);
}

// --- Items ---------------------------------------------------------------------------

/** Puts an item in place: replaced when its id is known, appended otherwise. */
function upsert(state: TranscriptState, item: ChatItem): void {
  const existing = state.index.get(item.id);
  if (existing === undefined) {
    state.index.set(item.id, item);
    state.items.push(item);
    return;
  }
  const at = state.items.indexOf(existing);
  if (at >= 0) state.items[at] = item;
  state.index.set(item.id, item);
  if (item.kind === 'fileEdit') state.edits.set(item.path, item);
}

/** A turn starts with the user's message that set it going. */
function ensureTurn(state: TranscriptState, id: string): void {
  if (state.activeTurnId !== null) return;
  const turn: Turn = {
    id,
    startedAt: Date.now(),
    endedAt: null,
    apiDurationMs: 0,
    requests: 0,
    usage: { input_tokens: 0, output_tokens: 0 },
    reason: null,
    error: null,
  };
  state.turns.push(turn);
  state.activeTurnId = id;
}
