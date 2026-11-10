import { asArray, asNumber, asObject, asString, type JsonObject } from './json.js';

/**
 * The control requests the CLI sends the host, and the responses it takes.
 *
 * The CLI is started with `--permission-prompt-tool stdio`, which is what
 * makes it ask rather than guess.
 */

// --- Requests the CLI sends --------------------------------------------------

export type ControlRequest =
  | CanUseToolRequest
  | HookCallbackRequest
  | McpMessageRequest
  | ElicitationRequest
  | UnknownControlRequest;

/** Asks the host whether a tool call may run. */
export interface CanUseToolRequest {
  subtype: 'can_use_tool';
  tool_name: string;
  input: JsonObject;
  tool_use_id?: string;
  permission_suggestions?: PermissionUpdate[];
  display_name?: string;
  description?: string;
  decision_reason?: string;
  decision_reason_type?: string;
  matched_ask_rule?: string;
  classifier_approvable?: boolean;
  requires_user_interaction?: boolean;
  blocked_path?: string;
  agent_id?: string;
}

/**
 * Asks the host to run one of the hooks the host itself registered with
 * `initialize`. Returning is what lets a tool call go ahead: this is the
 * only reliable point at which a file can be read before the agent edits it.
 */
export interface HookCallbackRequest {
  subtype: 'hook_callback';
  callback_id: string;
  input: JsonObject;
  tool_use_id?: string;
}

/** A message from an MCP server the host runs in-process (`--mcp-config` type `sdk`). */
export interface McpMessageRequest {
  subtype: 'mcp_message';
  server_name: string;
  message: JsonObject;
}

/** An MCP server asking the user for input (a form, or a URL to open). */
export interface ElicitationRequest {
  subtype: 'elicitation';
  [key: string]: unknown;
}

export interface UnknownControlRequest {
  subtype: string;
  [key: string]: unknown;
}

/** Reads a `control_request` frame's `request` field. */
export function readControlRequest(raw: unknown): ControlRequest {
  const request = asObject(raw);
  return request as unknown as ControlRequest;
}

// --- Responses the host sends ------------------------------------------------

/** What the host says to a `can_use_tool`. */
export type PermissionResponse =
  | { behavior: 'allow'; updatedInput?: JsonObject; updatedPermissions?: PermissionUpdate[] }
  | { behavior: 'deny'; message: string; interrupt?: boolean };

/** What a permission answer changes from then on. */
export type PermissionUpdate =
  | { type: 'addRules'; rules: PermissionRule[]; behavior: RuleBehavior; destination: RuleDestination }
  | { type: 'replaceRules'; rules: PermissionRule[]; behavior: RuleBehavior; destination: RuleDestination }
  | { type: 'setMode'; mode: PermissionMode; destination: RuleDestination }
  | { type: 'addDirectories'; directories: string[]; destination: RuleDestination };

export type RuleBehavior = 'allow' | 'deny' | 'ask';

/** Where a rule is kept: this process, this app, or the user's project. */
export type RuleDestination = 'session' | 'localSettings' | 'projectSettings' | 'userSettings';

export interface PermissionRule {
  toolName?: string;
  ruleContent?: string;
}

export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'plan'
  | 'bypassPermissions'
  | 'dontAsk'
  | 'auto';

/** What a hook callback answers: empty means "carry on". */
export interface HookCallbackResponse {
  decision?: 'allow' | 'deny' | 'ask';
  reason?: string;
  hookSpecificOutput?: JsonObject;
  [key: string]: unknown;
}

/** The frame a host writes to answer a control request. */
export function controlResponseFrame(
  requestId: string,
  response: JsonObject,
): JsonObject {
  return {
    type: 'control_response',
    response: { subtype: 'success', request_id: requestId, response },
  };
}

/** The frame a host writes when it could not answer a control request. */
export function controlErrorFrame(requestId: string, error: string): JsonObject {
  return {
    type: 'control_response',
    response: { subtype: 'error', request_id: requestId, error },
  };
}

// --- Requests the host sends -------------------------------------------------

/** `initialize`: what the CLI should know before the first message. */
export interface InitializeRequest {
  subtype: 'initialize';
  promptSuggestions?: boolean;
  /** Hooks the host will answer through `hook_callback`. */
  hooks?: Record<string, HookMatcher[]>;
  /** MCP servers the host runs in-process. */
  sdkMcpServers?: JsonObject;
  [key: string]: unknown;
}

export interface HookMatcher {
  matcher?: string;
  hookCallbackIds: string[];
  timeout?: number;
}

/** Stops the turn running. With `sendNow`, takes up the message waiting instead. */
export interface InterruptRequest {
  subtype: 'interrupt';
  send_now?: boolean;
  message_uuid?: string;
  cancel_queued?: boolean;
}

/** Rewinds the conversation to before a message. */
export interface RewindConversationRequest {
  subtype: 'rewind_conversation';
  target_message_uuid: string;
  interrupt_if_running?: boolean;
}

/** Puts the files back as they were before a message. */
export interface RewindFilesRequest {
  subtype: 'rewind_files';
  user_message_id: string;
  dry_run?: boolean;
}

/** Reads the token budget: what the context holds, by kind. */
export interface ContextUsageRequest {
  subtype: 'get_context_usage';
}

/** Lists the hooks in force. */
export interface HooksListingRequest {
  subtype: 'get_hooks_listing';
}

/** What a session has cost so far. */
export interface UsageRequest {
  subtype: 'get_usage';
}

/** Files matching a fragment, for `@` completion. */
export interface FileSuggestionsRequest {
  subtype: 'file_suggestions';
  query: string;
}

/** Switches the model mid-session. */
export interface SetModelRequest {
  subtype: 'set_model';
  model: string;
}

/** Switches the permission mode mid-session. */
export interface SetPermissionModeRequest {
  subtype: 'set_permission_mode';
  mode: string;
}

/** Names the conversation. */
export interface RenameSessionRequest {
  subtype: 'rename_session';
  title: string;
}

/** Stops a background task. */
export interface StopTaskRequest {
  subtype: 'stop_task';
  task_id: string;
}

/** Sends a running foreground task to the background. */
export interface BackgroundTasksRequest {
  subtype: 'background_tasks';
  tool_use_id?: string;
}

/** Ends the session. */
export interface EndSessionRequest {
  subtype: 'end_session';
}

/** Reads numbers back from the CLI's answers without trusting their types. */
export function numberField(frame: JsonObject, key: string): number | null {
  return asNumber(frame[key]);
}

/** Reads a list of strings from a frame. */
export function stringList(value: unknown): string[] {
  return asArray(value).map((item) => asString(item)).filter((item): item is string => item !== null);
}
