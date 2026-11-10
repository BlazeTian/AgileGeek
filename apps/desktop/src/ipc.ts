import type { Envelope } from '@agilegeek/protocol';

/**
 * The one place the window talks to the shell.
 *
 * Everything goes through `invoke`, and the command names and argument
 * shapes are written down here rather than at each call site: the Rust
 * side's `tauri::generate_handler!` list is the other half of this
 * contract.
 */
export interface AppInfo {
  name: string;
  version: string;
  dataDir: string;
}

type Commands = {
  app_info: { args: Record<string, never>; result: AppInfo };
};

/** Calls one of the shell's commands. */
export async function invoke<K extends keyof Commands>(
  command: K,
  args: Commands[K]['args'] = {} as Commands[K]['args'],
): Promise<Commands[K]['result']> {
  const tauri = await import('@tauri-apps/api/core');
  return tauri.invoke<Commands[K]['result']>(command, args);
}

/**
 * Whether the window is running inside the shell. Opened in a browser (the
 * Vite dev server alone), it is not, and the app falls back to a mock.
 */
export async function inShell(): Promise<boolean> {
  try {
    const api = await import('@tauri-apps/api/core');
    return api.isTauri();
  } catch {
    return false;
  }
}

/** Listens for the envelopes the shell pushes. */
export async function onEnvelope(
  handler: (envelope: Envelope) => void,
): Promise<() => void> {
  const events = await import('@tauri-apps/api/event');
  const unlisten = await events.listen<Envelope>('agilegeek://envelope', (event) => {
    handler(event.payload);
  });
  return unlisten;
}
