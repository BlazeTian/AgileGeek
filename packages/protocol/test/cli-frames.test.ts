import { describe, expect, it } from 'vitest';
import { readFrame, isKnownFrame, toolUsesOf, resultUsage } from '../src/cli-frames.js';
import { readContent } from '../src/content.js';
import { readControlRequest, controlResponseFrame } from '../src/control.js';

describe('readFrame', () => {
  it('reads a stream-json line', () => {
    const frame = readFrame('{"type":"system","subtype":"init","cwd":"C:\\\\p","tools":["Read"]}');
    expect(frame?.type).toBe('system');
    expect(isKnownFrame(frame!)).toBe(true);
  });

  it('returns null for a line that is not JSON', () => {
    // The CLI sometimes writes diagnostics to stdout on Windows.
    expect(readFrame('Warning: something')).toBeNull();
  });

  it('returns null for JSON that is not an object', () => {
    expect(readFrame('[1,2,3]')).toBeNull();
    expect(readFrame('"text"')).toBeNull();
  });

  it('returns null when type is missing', () => {
    expect(readFrame('{"subtype":"init"}')).toBeNull();
  });

  it('keeps an unknown frame type instead of rejecting it', () => {
    const frame = readFrame('{"type":"something_new","payload":1}');
    expect(frame?.type).toBe('something_new');
    expect(isKnownFrame(frame!)).toBe(false);
  });
});

describe('tool uses', () => {
  it('reads tool_use blocks from an assistant frame', () => {
    const line = JSON.stringify({
      type: 'assistant',
      parent_tool_use_id: null,
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Looking.' },
          { type: 'tool_use', id: 'call_1', name: 'Read', input: { file_path: 'a.ts' } },
        ],
      },
    });
    const frame = readFrame(line);
    const calls = toolUsesOf(frame as never);
    expect(calls).toEqual([{ id: 'call_1', name: 'Read', input: { file_path: 'a.ts' } }]);
  });
});

describe('content', () => {
  it('wraps a string in a text block', () => {
    expect(readContent('hello')).toEqual([{ type: 'text', text: 'hello' }]);
  });

  it('drops an empty string', () => {
    expect(readContent('')).toEqual([]);
  });

  it('keeps unknown block kinds', () => {
    const blocks = readContent([{ type: 'server_tool_use', id: 'x' }]);
    expect(blocks[0]?.type).toBe('server_tool_use');
  });
});

describe('result usage', () => {
  it('reads numbers sent as strings', () => {
    const frame = readFrame(
      JSON.stringify({ type: 'result', usage: { input_tokens: '12', output_tokens: 3 } }),
    );
    expect(resultUsage(frame as never)).toMatchObject({ input_tokens: 12, output_tokens: 3 });
  });

  it('defaults missing counts to zero', () => {
    const frame = readFrame('{"type":"result","usage":{}}');
    expect(resultUsage(frame as never).input_tokens).toBe(0);
  });
});

describe('control', () => {
  it('reads a can_use_tool request', () => {
    const request = readControlRequest({
      subtype: 'can_use_tool',
      tool_name: 'Bash',
      input: { command: 'npm test' },
      permission_suggestions: [
        {
          type: 'addRules',
          rules: [{ toolName: 'Bash', ruleContent: 'npm test' }],
          behavior: 'allow',
          destination: 'session',
        },
      ],
    });
    expect(request.subtype).toBe('can_use_tool');
    expect((request as { tool_name: string }).tool_name).toBe('Bash');
  });

  it('builds a success response frame', () => {
    expect(controlResponseFrame('r1', { behavior: 'allow' })).toEqual({
      type: 'control_response',
      response: { subtype: 'success', request_id: 'r1', response: { behavior: 'allow' } },
    });
  });
});
