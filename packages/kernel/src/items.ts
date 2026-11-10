import type { ContentBlock, JsonObject, Usage } from '@agilegeek/protocol';

/**
 * What the conversation is made of, as the UI renders it.
 *
 * Items are keyed by id and updated in place: the stream sends a delta
 * per token, then the whole message again, and both must land on the same
 * item rather than duplicate it.
 */
export interface ItemBase {
  id: string;
  /** The turn this item belongs to: one user message and what it set going. */
  turnId: string | null;
  /** The subagent whose work this is; null for the main agent. */
  parentToolUseId: string | null;
}

/** Anything the conversation shows, told apart by `kind`. */
export type ChatItem =
  | UserMessageItem
  | AssistantTextItem
  | ThinkingItem
  | ToolCallItem
  | FileEditItem
  | NoticeItem
  | PlanItem
  | AgentItem;

/** The item kinds that fold: what `isQuickStep` can see. */
export type FoldableItem = AssistantTextItem | ThinkingItem | ToolCallItem;

export interface UserMessageItem extends ItemBase {
  kind: 'user';
  text: string;
  images: ImageRef[];
  /** A message that was sent while the agent worked, not yet taken up. */
  queued: boolean;
  /** Where it sits in the queue, when queued. */
  priority: 'now' | 'next' | 'later';
  /** Written by the agent itself (a background task ending), not the user. */
  own: boolean;
  at: number;
}

export interface ImageRef {
  mediaType: string;
  data: string;
}

export interface AssistantTextItem extends ItemBase {
  kind: 'assistantText';
  text: string;
  /** True while tokens are still arriving. */
  streaming: boolean;
  model: string | null;
  at: number;
}

export interface ThinkingItem extends ItemBase {
  kind: 'thinking';
  text: string;
  streaming: boolean;
  /** Milliseconds spent thinking, when the CLI reports it. */
  durationMs: number | null;
  at: number;
}

export interface ToolCallItem extends ItemBase {
  kind: 'toolCall';
  toolUseId: string;
  name: string;
  input: JsonObject;
  /** The result, once the call is answered. */
  result: ToolResultData | null;
  state: 'running' | 'done' | 'error' | 'denied';
  startedAt: number;
  endedAt: number | null;
  /** The subagent this call started, when the tool is `Task`/`Agent`. */
  agentId: string | null;
}

export interface ToolResultData {
  content: string;
  isError: boolean;
  /** What the host was told of it, for a richer view. */
  raw: unknown;
}

/** A file the agent changed, as the conversation shows it. */
export interface FileEditItem extends ItemBase {
  kind: 'fileEdit';
  path: string;
  toolUseId: string;
  /** The edit's own diff, when the CLI reports one. */
  added: number | null;
  removed: number | null;
  /** Whether the change is still undoable. */
  unseen: boolean;
}

export interface NoticeItem extends ItemBase {
  kind: 'notice';
  level: 'info' | 'notice' | 'warning' | 'error';
  text: string;
  at: number;
}

export interface PlanItem extends ItemBase {
  kind: 'plan';
  text: string;
  state: 'drafting' | 'awaiting' | 'approved' | 'sentBack';
  path: string | null;
  at: number;
}

export interface AgentItem extends ItemBase {
  kind: 'agent';
  agentId: string;
  description: string;
  agentType: string | null;
  state: 'running' | 'done' | 'failed' | 'stopped';
  startedAt: number;
  endedAt: number | null;
  /** What the subagent is doing right now, a line. */
  activity: string | null;
  toolUses: number;
  tokens: number;
}

export type ChatItemKind = ChatItem['kind'];

/** The turn as a whole: what it cost and how long it took. */
export interface Turn {
  id: string;
  startedAt: number;
  endedAt: number | null;
  /** How long the model itself ran, without the tools. */
  apiDurationMs: number;
  requests: number;
  usage: Usage;
  /** Why it ended: `end_turn`, `interrupted`, `error`, `max_turns`, `stopped`. */
  reason: string | null;
  error: string | null;
}

/** A control request waiting for the user. */
export type PendingInteraction =
  | { kind: 'permission'; requestId: string; toolName: string; input: JsonObject; description: string | null; suggestions: unknown[]; at: number }
  | { kind: 'question'; requestId: string; questions: Question[]; at: number };

export interface Question {
  question: string;
  header: string;
  options: { label: string; description: string }[];
  multiSelect: boolean;
}

/** A message the user sent that has not been taken up yet. */
export interface QueuedMessage {
  uuid: string;
  text: string;
  priority: 'now' | 'next' | 'later';
  at: number;
}

/** A task running in the background: a command, or a subagent. */
export interface BackgroundTask {
  id: string;
  kind: 'command' | 'agent' | 'other';
  description: string;
  status: string;
  command: string | null;
  agentType: string | null;
}
