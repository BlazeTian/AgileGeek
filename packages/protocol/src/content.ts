import { asObject, type JsonObject } from './json.js';

/** The blocks of a message's content, as the Anthropic Messages API has them. */
export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | RedactedThinkingBlock
  | ToolUseBlock
  | ToolResultBlock
  | ImageBlock
  | UnknownBlock;

export interface TextBlock {
  type: 'text';
  text: string;
  /** Present when the block was cached. Never used for rendering. */
  cache_control?: JsonObject;
}

export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

export interface RedactedThinkingBlock {
  type: 'redacted_thinking';
  data?: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: JsonObject;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
  is_error?: boolean;
}

export interface ImageBlock {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    media_type?: string;
    data?: string;
    url?: string;
  };
}

/** A block this build does not know: kept as it came, so nothing is lost. */
export interface UnknownBlock {
  type: string;
  [key: string]: unknown;
}

/** A message's content: text, or blocks. */
export type MessageContent = string | ContentBlock[];

/** Token counts of one request, as the API reports them. */
export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  service_tier?: string;
  [key: string]: unknown;
}

/** Reads one block, keeping unknown kinds intact. */
export function readContentBlock(raw: unknown): ContentBlock {
  const block = asObject(raw);
  return block as unknown as ContentBlock;
}

/** Reads a message's content as blocks, wrapping a string in one text block. */
export function readContent(raw: unknown): ContentBlock[] {
  if (typeof raw === 'string') {
    return raw.length === 0 ? [] : [{ type: 'text', text: raw }];
  }
  return Array.isArray(raw) ? raw.map(readContentBlock) : [];
}

/** The text of a message's content, its text blocks joined. */
export function textOf(content: MessageContent): string {
  if (typeof content === 'string') return content;
  return content
    .filter((block): block is TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}
