import type { Envelope } from '@agilegeek/protocol';

/**
 * The one place the window talks to the shell.
 *
 * Command names and argument shapes are written down here, so the Rust
 * side's `generate_handler!` list has a counterpart that is checked when
 * this compiles.
 */
export interface AppInfo {
  name: string;
  version: string;
  dataDir: string;
  /** The Claude Code the shell found, if any. */
  cli: string | null;
  cliVersion: string | null;
}

export interface CliProgress {
  kind: 'starting' | 'downloading' | 'unpacking' | 'done';
  soFar: number;
  total: number;
}

export interface SessionOptions {
  cwd: string;
  resume?: string | null;
  model?: string | null;
  permissionMode?: string | null;
  directories?: string[];
  settings?: unknown;
  appendSystemPrompt?: string | null;
}

export interface FsEntry {
  name: string;
  path: string;
  isDir: boolean;
  children: FsEntry[] | null;
}

type Commands = {
  app_info: { args: Record<string, never>; result: AppInfo };
  install_cli: { args: Record<string, never>; result: string };
  fs_list: { args: { path: string }; result: FsEntry[] };
  home_dir: { args: Record<string, never>; result: string };
  session_open: {
    args: { id: string; options: SessionOptions };
    result: string;
  };
  session_send: {
    args: { id: string; text: string; uuid: string };
    result: null;
  };
  session_interrupt: { args: { id: string }; result: null };
  session_close: { args: { id: string }; result: null };
  permission_answer: {
    args: {
      id: string;
      requestId: string;
      allow: boolean;
      updatedInput?: unknown;
      message?: string;
    };
    result: null;
  };
};

/** Calls one of the shell's commands. */
export async function invoke<K extends keyof Commands>(
  command: K,
  args: Commands[K]['args'] = {} as Commands[K]['args'],
): Promise<Commands[K]['result']> {
  const tauri = await import('@tauri-apps/api/core');
  return tauri.invoke<Commands[K]['result']>(command, args as Record<string, unknown>);
}

/** Listens for the envelopes the shell pushes. */
export async function onEnvelope(
  handler: (envelope: Envelope) => void,
): Promise<() => void> {
  const events = await import('@tauri-apps/api/event');
  return events.listen<Envelope>('agilegeek://envelope', (event) => {
    handler(event.payload);
  });
}

/** Listens for the CLI download's progress. */
export async function onCliProgress(
  handler: (progress: CliProgress) => void,
): Promise<() => void> {
  const events = await import('@tauri-apps/api/event');
  return events.listen<CliProgress>('agilegeek://cli', (event) => {
    handler(event.payload);
  });
}
