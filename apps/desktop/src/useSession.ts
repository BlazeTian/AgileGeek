import { useCallback, useEffect, useRef, useState } from 'react';
import { readFrame, asArray, asObject, asString } from '@agilegeek/protocol';
import type { Envelope } from '@agilegeek/protocol';
import { applyFrame, emptyTranscript, type TranscriptState } from '@agilegeek/kernel';
import { invoke, onEnvelope } from './ipc.js';

export type Connection = 'idle' | 'starting' | 'ready' | 'failed';

export interface SessionView {
  transcript: TranscriptState;
  connection: Connection;
  /** Why it stopped, in words. */
  reason: string | null;
  cli: string | null;
  cliVersion: string | null;
  /** The session id the CLI named. */
  sessionId: string | null;
  /** The context window the model reports. */
  send: (text: string) => void;
  interrupt: () => void;
  answerPermission: (requestId: string, allow: boolean) => void;
}

/**
 * One conversation: starts a session in a folder, sends what the user
 * types, and folds every frame the shell sends into the transcript.
 *
 * The reducer is the only place frames are interpreted; everything this
 * hook adds is the boundary — process state, and the envelope's sequence
 * numbers, so a batch that arrives twice changes nothing.
 */
export function useSession(folder: string | null): SessionView {
  const [transcript, setTranscript] = useState<TranscriptState>(emptyTranscript);
  const [connection, setConnection] = useState<Connection>('idle');
  const [reason, setReason] = useState<string | null>(null);
  const [cli, setCli] = useState<string | null>(null);
  const [cliVersion, setCliVersion] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const idRef = useRef<string | null>(null);
  const epochRef = useRef(0);
  const seenRef = useRef(0);

  /** Applies a batch of frames, in order, dropping what was applied. */
  const applyFrames = useCallback((items: { seq: number; f: unknown }[]) => {
    setTranscript((state) => {
      const next = { ...state, items: [...state.items], index: new Map(state.index) };
      for (const item of items) {
        if (item.seq <= seenRef.current) continue;
        seenRef.current = item.seq;
        const frame = readFrame(JSON.stringify(item.f));
        if (frame === null) continue;
        applyFrame(next, frame, item.seq);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    onEnvelope((envelope: Envelope) => {
      if (disposed) return;
      if (envelope.t === 'frames') {
        if (envelope.epoch !== epochRef.current) return;
        if (envelope.sid !== idRef.current) return;
        applyFrames(envelope.items);
        return;
      }
      if (envelope.t === 'transport') {
        if (envelope.epoch !== epochRef.current) return;
        if (envelope.state === 'ready') setConnection('ready');
        if (envelope.state === 'starting') setConnection('starting');
        if (envelope.state === 'exited' || envelope.state === 'failed') {
          setConnection('failed');
          setReason(envelope.reason ?? null);
        }
        if (envelope.executable) setCli(envelope.executable);
        return;
      }
    }).then((off) => {
      if (disposed) off();
      else unlisten = off;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [applyFrames]);

  // The CLI names its own session in the init frame; keep it for `--resume`.
  useEffect(() => {
    const init = transcript.items.find((item) => item.kind === 'notice');
    void init;
  }, [transcript.items]);

  useEffect(() => {
    if (folder === null) {
      setConnection('idle');
      return;
    }

    let cancelled = false;
    const id = `s_${Date.now().toString(36)}`;
    idRef.current = id;
    epochRef.current = 0;
    seenRef.current = 0;
    setTranscript(emptyTranscript());
    setConnection('starting');
    setReason(null);
    setSessionId(null);

    invoke('session_open', {
      id,
      options: {
        cwd: folder,
        permissionMode: 'default',
        appendSystemPrompt: null,
      },
    })
      .then((started) => {
        if (!cancelled) setConnection('ready');
        return started;
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setConnection('failed');
        setReason(String(error));
      });

    return () => {
      cancelled = true;
      invoke('session_close', { id }).catch(() => {});
    };
  }, [folder]);

  const send = useCallback((text: string) => {
    const id = idRef.current;
    if (id === null || text.trim().length === 0) return;
    invoke('session_send', { id, text, uuid: crypto.randomUUID() }).catch(() => {});
  }, []);

  const interrupt = useCallback(() => {
    const id = idRef.current;
    if (id === null) return;
    invoke('session_interrupt', { id }).catch(() => {});
  }, []);

  const answerPermission = useCallback((requestId: string, allow: boolean) => {
    const id = idRef.current;
    if (id === null) return;
    invoke('permission_answer', { id, requestId, allow }).catch(() => {});
  }, []);

  return {
    transcript,
    connection,
    reason,
    cli,
    cliVersion,
    sessionId,
    send,
    interrupt,
    answerPermission,
  };
}

/** Reads what a tool call is doing, in a few words. */
export function describeTool(name: string, input: unknown): string {
  const fields = asObject(input);
  switch (name) {
    case 'Read':
    case 'Write':
    case 'NotebookRead': {
      const path = asString(fields.file_path) ?? '';
      return fileName(path);
    }
    case 'Edit':
    case 'MultiEdit':
      return fileName(asString(fields.file_path) ?? '');
    case 'Bash':
    case 'PowerShell': {
      const command = asString(fields.command) ?? '';
      return command.length > 60 ? `${command.slice(0, 60)}…` : command;
    }
    case 'Grep':
    case 'Glob':
      return asString(fields.pattern) ?? '';
    case 'WebFetch':
      return asString(fields.url) ?? '';
    case 'WebSearch':
      return asString(fields.query) ?? '';
    case 'Agent':
    case 'Task':
      return asString(fields.description) ?? '';
    default: {
      const first = Object.values(fields)[0];
      return typeof first === 'string' ? first.slice(0, 60) : '';
    }
  }
}

/** The last part of a path, whichever slash it uses. */
function fileName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}

/** The text of a permission request, as the card shows it. */
export function permissionPreview(name: string, input: unknown): string {
  const fields = asObject(input);
  const command = asString(fields.command);
  if (command !== null) return command;
  const path = asString(fields.file_path);
  if (path !== null) {
    const old = asString(fields.old_string);
    if (old !== null) return `${path}\n\n- ${old.slice(0, 200)}`;
    return path;
  }
  const url = asString(fields.url);
  if (url !== null) return url;
  const entries = Object.entries(fields).slice(0, 4);
  return entries.map(([key, value]) => `${key}: ${asString(value) ?? JSON.stringify(value)}`).join('\n');
}

/** The questions a request carries, if it is `AskUserQuestion`. */
export function questionsOf(input: unknown): { question: string; header: string; options: { label: string; description: string }[] }[] {
  const fields = asObject(input);
  return asArray(fields.questions).map((raw) => {
    const question = asObject(raw);
    return {
      question: asString(question.question) ?? '',
      header: asString(question.header) ?? '',
      options: asArray(question.options).map((option) => {
        const item = asObject(option);
        return {
          label: asString(item.label) ?? '',
          description: asString(item.description) ?? '',
        };
      }),
    };
  });
}
