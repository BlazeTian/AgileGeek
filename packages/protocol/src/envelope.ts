import type { CliFrame } from './cli-frames.js';

/**
 * What the Rust side sends the webview.
 *
 * Frames of one session are batched: a long answer produces thousands of
 * token-level deltas, and one IPC message each would starve the webview.
 *
 * `seq` is assigned by Rust and only ever grows within an `epoch`; the
 * reducer uses it to drop duplicates and to ignore frames from a process
 * that has since been replaced (`epoch` goes up on every restart).
 */
export type Envelope =
  | FramesEnvelope
  | TransportEnvelope
  | ReviewEnvelope
  | ReviewReplayedEnvelope;

export interface FramesEnvelope {
  t: 'frames';
  sid: string;
  epoch: number;
  items: SequencedFrame[];
}

export interface SequencedFrame {
  seq: number;
  /** One line of the CLI's stdout, decoded. Kept as the raw frame. */
  f: CliFrame;
}

/** The session's process: starting, ready, or gone. */
export interface TransportEnvelope {
  t: 'transport';
  sid: string;
  epoch: number;
  state: 'starting' | 'ready' | 'exited' | 'failed';
  code?: number;
  stderr?: string;
  executable?: string;
  /** Why it failed, as the host understands it. */
  reason?: string;
}

/** A file the agent touched, as the change review saw it. */
export interface ReviewEnvelope {
  t: 'review';
  sid: string;
  kind: 'before' | 'after' | 'settled' | 'conflict' | 'unseen';
  path: string;
}

/** The review of a session as kept on disk, sent when a session is reopened. */
export interface ReviewReplayedEnvelope {
  t: 'reviewReplayed';
  sid: string;
  entries: ReviewEntry[];
}

export interface ReviewEntry {
  path: string;
  /** Blob id of the file before the agent's edit; null when it did not exist. */
  base: string | null;
  /** Blob id of the file as the agent left it; null while the edit runs. */
  after: string | null;
  /**
   * Set when the change cannot be undone: an edit made through Bash, or
   * one whose before-state was never captured.
   */
  unseen?: boolean;
  conflict?: boolean;
}

/** Whether an envelope belongs to the process generation in view. */
export function isCurrent(epoch: number, currentEpoch: number): boolean {
  return epoch === currentEpoch;
}
