import { describe, expect, it } from 'vitest';
import { readFrame } from '@agilegeek/protocol';
import { applyFrame, emptyTranscript } from '../src/transcript.js';

/** Feeds JSON lines, in order, as the CLI would write them. */
function replay(lines: string[]) {
  const state = emptyTranscript();
  let seq = 0;
  for (const line of lines) {
    const frame = readFrame(line);
    if (frame === null) continue;
    applyFrame(state, frame, seq++);
  }
  return state;
}

const start = (id: string) =>
  JSON.stringify({
    type: 'stream_event',
    parent_tool_use_id: null,
    event: {
      type: 'message_start',
      message: { id, role: 'assistant', model: 'deepseek-chat', content: [] },
    },
  });

const textStart = JSON.stringify({
  type: 'stream_event',
  parent_tool_use_id: null,
  event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
});

const delta = (text: string) =>
  JSON.stringify({
    type: 'stream_event',
    parent_tool_use_id: null,
    event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
  });

const blockStop = JSON.stringify({
  type: 'stream_event',
  parent_tool_use_id: null,
  event: { type: 'content_block_stop', index: 0 },
});

const fullMessage = (id: string, text: string) =>
  JSON.stringify({
    type: 'assistant',
    parent_tool_use_id: null,
    message: {
      id,
      role: 'assistant',
      model: 'deepseek-chat',
      content: [{ type: 'text', text }],
    },
  });

describe('streaming', () => {
  it('appends deltas to one item', () => {
    const state = replay([start('m1'), textStart, delta('Hello'), delta(', world')]);
    const items = state.items.filter((item) => item.kind === 'assistantText');
    expect(items).toHaveLength(1);
    expect((items[0] as { text: string }).text).toBe('Hello, world');
    expect((items[0] as { streaming: boolean }).streaming).toBe(true);
  });

  it('does not duplicate when the whole message arrives after the deltas', () => {
    const state = replay([
      start('m1'),
      textStart,
      delta('Hello'),
      delta(', world'),
      blockStop,
      fullMessage('m1', 'Hello, world'),
    ]);
    const items = state.items.filter((item) => item.kind === 'assistantText');
    expect(items).toHaveLength(1);
    expect((items[0] as { text: string }).text).toBe('Hello, world');
    expect((items[0] as { streaming: boolean }).streaming).toBe(false);
  });

  it('replaces a half-streamed message with the final text', () => {
    // A dropped delta is the common case: the complete message is the truth.
    const state = replay([start('m1'), textStart, delta('Hel'), blockStop, fullMessage('m1', 'Hello')]);
    const item = state.items.find((candidate) => candidate.kind === 'assistantText');
    expect((item as { text: string }).text).toBe('Hello');
  });

  it('starts a new item for the next message', () => {
    const state = replay([
      start('m1'),
      textStart,
      delta('one'),
      blockStop,
      fullMessage('m1', 'one'),
      start('m2'),
      textStart,
      delta('two'),
    ]);
    expect(state.items.filter((item) => item.kind === 'assistantText')).toHaveLength(2);
  });

  it('ignores deltas that arrive with no message open', () => {
    // A restart, or frames reordered after a reconnect.
    const state = replay([delta('orphan')]);
    expect(state.items).toHaveLength(0);
  });
});

describe('tool calls', () => {
  const toolUse = (id: string, name: string, input: unknown) =>
    JSON.stringify({
      type: 'assistant',
      parent_tool_use_id: null,
      message: { id: 'm1', role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
    });

  const toolResult = (id: string, content: string, isError = false) =>
    JSON.stringify({
      type: 'user',
      parent_tool_use_id: null,
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: id, content, ...(isError ? { is_error: true } : {}) }],
      },
    });

  it('pairs a result with its call', () => {
    const state = replay([
      toolUse('c1', 'Read', { file_path: 'a.ts' }),
      toolResult('c1', 'file contents'),
    ]);
    const call = state.items.find((item) => item.kind === 'toolCall');
    expect((call as { state: string }).state).toBe('done');
    expect((call as { result: { content: string } }).result.content).toBe('file contents');
  });

  it('marks a failed call as an error', () => {
    const state = replay([toolUse('c1', 'Bash', { command: 'false' }), toolResult('c1', 'boom', true)]);
    const call = state.items.find((item) => item.kind === 'toolCall');
    expect((call as { state: string }).state).toBe('error');
  });

  it('ignores a result for a call it never saw', () => {
    const state = replay([toolResult('missing', 'x')]);
    expect(state.items).toHaveLength(0);
  });
});

describe('user messages and results', () => {
  it('shows a replayed user message, not a tool result', () => {
    const state = replay([
      JSON.stringify({
        type: 'user',
        parent_tool_use_id: null,
        uuid: 'u1',
        message: { role: 'user', content: [{ type: 'text', text: 'fix the bug' }] },
      }),
    ]);
    const users = state.items.filter((item) => item.kind === 'user');
    expect(users).toHaveLength(1);
    expect((users[0] as { text: string }).text).toBe('fix the bug');
  });

  it('hides meta messages (hooks, notes)', () => {
    const state = replay([
      JSON.stringify({
        type: 'user',
        parent_tool_use_id: null,
        isMeta: true,
        message: { role: 'user', content: [{ type: 'text', text: 'hook feedback' }] },
      }),
    ]);
    expect(state.items).toHaveLength(0);
  });
});

describe('result', () => {
  it('closes the turn and records the cost', () => {
    const state = replay([
      start('m1'),
      textStart,
      delta('done'),
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        duration_ms: 1000,
        duration_api_ms: 800,
        num_turns: 2,
        result: 'done',
        stop_reason: 'end_turn',
        total_cost_usd: 0.0123,
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    ]);
    expect(state.activeTurnId).toBeNull();
    expect(state.totalCostUsd).toBeCloseTo(0.0123);
    expect(state.lastUsage?.input_tokens).toBe(10);
    expect(state.turns.at(-1)?.reason).toBe('end_turn');
  });

  it('shows an error result as a notice', () => {
    const state = replay([
      JSON.stringify({
        type: 'result',
        subtype: 'error_during_execution',
        is_error: true,
        result: 'API Error: 401',
      }),
    ]);
    const notice = state.items.find((item) => item.kind === 'notice');
    expect((notice as { level: string }).level).toBe('error');
  });
});

describe('robustness', () => {
  it('survives a line of diagnostics on stdout', () => {
    const state = replay([
      'Microsoft Windows [Version 10.0.26200]',
      start('m1'),
      'npm warn something',
      textStart,
      delta('ok'),
    ]);
    expect(state.items.filter((item) => item.kind === 'assistantText')).toHaveLength(1);
  });

  it('survives an unknown frame type', () => {
    const state = replay(['{"type":"some_future_frame","x":1}', start('m1'), textStart, delta('ok')]);
    expect(state.items).toHaveLength(1);
  });

  it('replaying the same frames twice is not doubled', () => {
    const lines = [start('m1'), textStart, delta('Hello'), blockStop, fullMessage('m1', 'Hello')];
    const once = replay(lines);
    const twice = replay([...lines, ...lines]);
    expect(twice.items.filter((item) => item.kind === 'assistantText')).toHaveLength(
      once.items.filter((item) => item.kind === 'assistantText').length,
    );
  });
});
