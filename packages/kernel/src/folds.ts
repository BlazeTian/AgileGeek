import type { ChatItem, ThinkingItem, ToolCallItem } from './items.js';

/**
 * Folding: what the conversation hides.
 *
 * A turn is often a hundred steps — read a file, search, read another —
 * before an answer. Showing each one buries the answer. The rules here are
 * the ones that keep a long turn readable: runs of quick steps become one
 * line, and the whole working part of a finished turn folds into one row.
 */

/** What a fold stands for. */
export type FoldKind =
  | 'steps'
  | 'work'
  | 'thinking';

export interface Fold {
  kind: FoldKind;
  /** The item ids the fold covers, in order. */
  ids: string[];
  /** One line describing it: "Read 3 files, ran 2 commands". */
  summary: string;
  /** The item to show instead of the fold when it is open. */
  expandTo: string | null;
}

/** A step that can be folded: a read, a search, a listing, a fetch. */
const QUICK_STEPS = new Set([
  'Read',
  'Glob',
  'Grep',
  'LS',
  'WebFetch',
  'WebSearch',
  'NotebookRead',
  'TodoWrite',
]);

/** A step that is never folded: it changed something the user must see. */
const NEVER_FOLD = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Agent', 'Task', 'SendMessage', 'AskUserQuestion']);

/** Whether a tool call is a "quick step": reading, looking, listing. */
export function isQuickStep(item: ChatItem): boolean {
  if (item.kind === 'toolCall') {
    const call = item as ToolCallItem;
    if (NEVER_FOLD.has(call.name)) return false;
    if (QUICK_STEPS.has(call.name)) return true;
    // A shell command that only looks: `cat`, `head`, `grep`, `ls`, `find`.
    if (call.name === 'Bash') {
      const command = typeof call.input.command === 'string' ? call.input.command : '';
      return isLookingCommand(command);
    }
    return false;
  }
  if (item.kind === 'thinking') return true;
  return false;
}

/** Whether a shell command only looks at the code. */
export function isLookingCommand(command: string): boolean {
  const first = command.trim().split(/\s+/)[0] ?? '';
  const base = first.split(/[\\/]/).pop() ?? first;
  return /^(cat|head|tail|less|more|grep|rg|ag|ack|find|fd|ls|dir|tree|stat|file|wc|git|npm|yarn|pnpm|cargo|python|node|dotnet)$/.test(base)
    ? true
    : /^(cat|head|tail|less|more)$/.test(base);
}

/**
 * Folds a finished turn's working part: everything before the last answer
 * becomes one "Worked for 4m 32s" row. Returns null when there is nothing
 * to fold.
 */
export function workFold(items: ChatItem[], turnId: string | null): Fold | null {
  if (turnId === null) return null;
  const ofTurn = items.filter((item) => item.turnId === turnId);
  const lastAnswer = [...ofTurn].reverse().find((item) => item.kind === 'assistantText');
  if (lastAnswer === undefined) return null;

  const before = ofTurn.slice(0, ofTurn.indexOf(lastAnswer));
  const work = before.filter((item) => item.kind !== 'user' && item.kind !== 'plan');
  if (work.length === 0) return null;
  return {
    kind: 'work',
    ids: work.map((item) => item.id),
    summary: summarize(work),
    expandTo: work[0]?.id ?? null,
  };
}

/**
 * Folds runs of quick steps. A run of one is left alone: hiding a single
 * "Read a.ts" would lose more than it saves.
 */
export function stepFolds(items: ChatItem[], liveTurnId: string | null): Fold[] {
  const folds: Fold[] = [];
  let run: ChatItem[] = [];

  const flush = () => {
    if (run.length < 2) {
      run = [];
      return;
    }
    folds.push({
      kind: 'steps',
      ids: run.map((item) => item.id),
      summary: summarize(run),
      expandTo: run[0]?.id ?? null,
    });
    run = [];
  };

  for (const item of items) {
    // A running turn is not folded: the user is watching it work.
    if (item.turnId === liveTurnId) {
      flush();
      continue;
    }
    if (isQuickStep(item)) {
      run.push(item);
    } else {
      flush();
    }
  }
  flush();
  return folds;
}

/** "Read 3 files, ran 2 commands, thought for 12s" */
export function summarize(items: ChatItem[]): string {
  const counts = new Map<string, number>();
  let thinkingMs = 0;
  for (const item of items) {
    if (item.kind === 'thinking') {
      thinkingMs += item.durationMs ?? 0;
      counts.set('thought', (counts.get('thought') ?? 0) + 1);
    } else if (item.kind === 'toolCall') {
      const action = actionOf(item as ToolCallItem);
      counts.set(action, (counts.get(action) ?? 0) + 1);
    }
  }
  const parts: string[] = [];
  const read = (counts.get('read') ?? 0) + (counts.get('searched') ?? 0) + (counts.get('listed') ?? 0);
  if (counts.has('read')) parts.push(`read ${plural(counts.get('read')!, 'file')}`);
  if (counts.has('searched')) parts.push(`searched ${plural(counts.get('searched')!, 'time')}`);
  if (counts.has('listed')) parts.push(`listed ${plural(counts.get('listed')!, 'folder')}`);
  if (counts.has('ran')) parts.push(`ran ${plural(counts.get('ran')!, 'command')}`);
  if (counts.has('fetched')) parts.push(`fetched ${plural(counts.get('fetched')!, 'page')}`);
  if (counts.has('thought')) {
    parts.push(thinkingMs > 0 ? `thought for ${duration(thinkingMs)}` : 'thought');
  }
  if (parts.length === 0) return `${items.length} steps`;
  return capitalize(parts.join(', '));
}

function actionOf(call: ToolCallItem): string {
  switch (call.name) {
    case 'Read':
    case 'NotebookRead':
      return 'read';
    case 'Grep':
    case 'Glob':
      return 'searched';
    case 'LS':
      return 'listed';
    case 'WebFetch':
    case 'WebSearch':
      return 'fetched';
    case 'Bash': {
      const command = typeof call.input.command === 'string' ? call.input.command : '';
      const base = command.trim().split(/\s+/)[0] ?? '';
      const name = base.split(/[\\/]/).pop() ?? base;
      if (/^(cat|head|tail|less|more)$/.test(name)) return 'read';
      if (/^(grep|rg|ag|ack|find|fd)$/.test(name)) return 'searched';
      if (/^(ls|dir|tree)$/.test(name)) return 'listed';
      return 'ran';
    }
    default:
      return 'ran';
  }
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function duration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1);
}

/** Merges consecutive thinking items: one "Thought for 12s" is enough. */
export function mergeThoughts(items: ChatItem[]): ChatItem[] {
  const out: ChatItem[] = [];
  let pending: ThinkingItem | null = null;
  for (const item of items) {
    if (item.kind === 'thinking') {
      const thought = item as ThinkingItem;
      if (pending !== null) {
        const merged: ThinkingItem = {
          ...pending,
          text: `${pending.text}\n\n${thought.text}`,
          durationMs: (pending.durationMs ?? 0) + (thought.durationMs ?? 0) || null,
        };
        out[out.length - 1] = merged;
        pending = merged;
        continue;
      }
      pending = thought;
    } else {
      pending = null;
    }
    out.push(item);
  }
  return out;
}
