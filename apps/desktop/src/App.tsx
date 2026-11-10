import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke, onCliProgress, type AppInfo, type CliProgress } from './ipc.js';
import { useSession, describeTool, permissionPreview, type SessionView } from './useSession.js';
import type { ChatItem, ToolCallItem } from '@agilegeek/kernel';
import { WorkArea } from './WorkArea.js';

/**
 * The window: a side bar of projects, the conversation, and the work area
 * beside it — the three columns the reference app has open.
 */
export default function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const session = useSession(folder);

  useEffect(() => {
    invoke('app_info').then(setInfo).catch(() => setInfo(null));
  }, []);

  return (
    <div className="shell">
      <MenuBar />
      <div className="columns">
        <Sidebar info={info} folder={folder} onOpenFolder={setFolder} />
        <main className="center">
          <CenterHead session={session} folder={folder} />
          <Conversation session={session} folder={folder} />
          <Changes session={session} />
          <Composer session={session} />
          <ComposerFoot session={session} />
        </main>
        <WorkArea folder={folder} />
      </div>
      <StatusBar info={info} session={session} onChanged={() => invoke('app_info').then(setInfo).catch(() => {})} />
    </div>
  );
}

/**
 * One row: the mark and the product's name, the window's menus, and what
 * the window is set to. The reference app has them on a single line too —
 * a second header bar only costs vertical space.
 */
function MenuBar() {
  return (
    <header className="menubar" data-tauri-drag-region>
      <span className="brand" data-tauri-drag-region>
        <span className="mark" aria-hidden="true" />
        <span className="brand-name">灵动极客</span>
        <span className="brand-latin">AGILEGEEK</span>
      </span>

      <span className="menubar-sep" />

      {['文件', '编辑', '查看', '帮助'].map((label) => (
        <button key={label} className="menu-item">
          {label}
        </button>
      ))}

      <span className="menubar-spacer" />
      <span className="fast-ide">⚡ Fast Ide</span>
    </header>
  );
}

function Sidebar({
  info,
  folder,
  onOpenFolder,
}: {
  info: AppInfo | null;
  folder: string | null;
  onOpenFolder: (folder: string) => void;
}) {
  const [query, setQuery] = useState('');

  const open = () => {
    // The folder picker comes with the shell's dialog command; until then a
    // conversation starts in the app's own directory.
    const next = info?.dataDir ?? '';
    if (next.length > 0) onOpenFolder(next);
  };

  return (
    <aside className="sidebar">
      <div className="side-actions">
        <button className="side-action primary" onClick={open}>
          <span className="icon">＋</span>
          新对话
        </button>
        <button className="side-action" onClick={open}>
          <span className="icon">▤</span>
          打开项目
        </button>
        <button className="side-action" onClick={() => setQuery(query === '' ? ' ' : '')}>
          <span className="icon">⌕</span>
          搜索
        </button>
        <button className="side-action">
          <span className="icon">✦</span>
          技能
        </button>
        <button className="side-action">
          <span className="icon">▣</span>
          Stash
        </button>
      </div>

      <div className="group-head">
        <span>智能体</span>
        <button>按项目 ▾</button>
      </div>

      <div className="threads">
        {folder === null ? (
          <div className="thread">
            <div className="thread-summary" style={{ paddingLeft: 8 }}>
              还没有对话。新建一个开始。
            </div>
          </div>
        ) : (
          <div className="thread selected">
            <div className="thread-line">
              <span className="chevron">▾</span>
              <span className="avatar" style={{ background: 'var(--accent-strong)' }}>
                {baseName(folder).slice(0, 1).toUpperCase()}
              </span>
              <span className="name">{baseName(folder)}</span>
              <span className="when">刚刚</span>
            </div>
            <div className="thread-summary">当前对话</div>
          </div>
        )}
      </div>

      <div className="side-foot">
        <button>⚙ 设置</button>
        <button>已归档：0</button>
      </div>
    </aside>
  );
}

function CenterHead({ session, folder }: { session: SessionView; folder: string | null }) {
  return (
    <div className="center-head">
      <span className="title">{folder === null ? '新对话' : baseName(folder)}</span>
      {session.connection === 'starting' ? <span className="spinner" /> : null}
      <button className="icon-button" title="会话信息">
        ⓘ
      </button>
      <button className="icon-button" title="双栏">
        ◫
      </button>
    </div>
  );
}

function Conversation({ session, folder }: { session: SessionView; folder: string | null }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const items = session.transcript.items;

  useEffect(() => {
    const element = scrollRef.current;
    if (element === null || !stickRef.current) return;
    element.scrollTop = element.scrollHeight;
  }, [items.length, session.transcript.activeTurnId]);

  const onScroll = () => {
    const element = scrollRef.current;
    if (element === null) return;
    stickRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 60;
  };

  // Consecutive quick steps are shown as one line, as the reference does.
  const blocks = useMemo(() => group(items), [items]);

  return (
    <div className="feed-scroll" ref={scrollRef} onScroll={onScroll}>
      {items.length === 0 ? (
        <EmptyState folder={folder} />
      ) : (
        <div className="feed">
          {blocks.map((block) =>
            block.kind === 'fold' ? (
              <FoldRow key={block.key} items={block.items} />
            ) : (
              <Item key={block.item.id} item={block.item} />
            ),
          )}
          {session.transcript.pending.map((pending) =>
            pending.kind === 'permission' ? (
              <PermissionCard
                key={pending.requestId}
                toolName={pending.toolName}
                input={pending.input}
                onAnswer={(allow) => session.answerPermission(pending.requestId, allow)}
              />
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

type Block =
  | { kind: 'fold'; key: string; items: ToolCallItem[] }
  | { kind: 'item'; item: ChatItem };

/** A run of tool calls becomes one line; anything else stands alone. */
function group(items: ChatItem[]): Block[] {
  const blocks: Block[] = [];
  let run: ToolCallItem[] = [];
  const flush = () => {
    if (run.length === 0) return;
    if (run.length === 1 && run[0] !== undefined) {
      blocks.push({ kind: 'item', item: run[0] });
    } else {
      const first = run[0];
      blocks.push({ kind: 'fold', key: `fold:${first?.id ?? ''}`, items: run });
    }
    run = [];
  };
  for (const item of items) {
    if (item.kind === 'toolCall' && item.state !== 'running') {
      run.push(item);
    } else {
      flush();
      blocks.push({ kind: 'item', item });
    }
  }
  flush();
  return blocks;
}

const VERBS: Record<string, string> = {
  Read: '读取文件',
  NotebookRead: '读取笔记',
  Edit: '编辑文件',
  MultiEdit: '编辑文件',
  Write: '写入文件',
  Bash: '运行命令',
  PowerShell: '运行命令',
  Grep: '搜索内容',
  Glob: '查找文件',
  WebFetch: '读取网页',
  WebSearch: '搜索网络',
  Agent: '调用子代理',
  Task: '调用子代理',
};

function FoldRow({ items }: { items: ToolCallItem[] }) {
  const counts = new Map<string, number>();
  for (const call of items) {
    const verb = VERBS[call.name] ?? call.name;
    counts.set(verb, (counts.get(verb) ?? 0) + 1);
  }
  const parts = [...counts.entries()].map(([verb, count]) =>
    verb.startsWith('运') || verb.startsWith('调用') || verb.startsWith('搜索')
      ? `${verb} ${count} 条`
      : `${verb} ${count} 个`,
  );
  return (
    <button className="fold-row" title={items.map((call) => describeTool(call.name, call.input)).join('\n')}>
      <span className="chevron">▸</span>
      {parts.join('，')}
    </button>
  );
}

function Item({ item }: { item: ChatItem }) {
  switch (item.kind) {
    case 'user':
      return <div className="user-message">{item.text}</div>;

    case 'assistantText':
      return (
        <p className="answer">
          {item.text}
          {item.streaming ? <span className="caret" /> : null}
        </p>
      );

    case 'thinking':
      return (
        <div className="thought-line">
          {item.streaming ? '思考中…' : item.durationMs !== null ? `已思考 ${Math.round(item.durationMs / 1000)} 秒` : '已思考'}
        </div>
      );

    case 'toolCall':
      return (
        <div className={`step ${item.state === 'running' ? 'running' : ''}`}>
          <span className="dot" />
          <span className="label">{VERBS[item.name] ?? item.name}</span>
          <span className="detail">{describeTool(item.name, item.input)}</span>
        </div>
      );

    case 'notice':
      return (
        <div
          className={`notice ${item.level === 'error' ? 'error' : item.level === 'warning' ? 'warning' : ''}`}
        >
          {item.text}
        </div>
      );

    case 'plan':
      return <div className="notice">{item.text}</div>;

    case 'fileEdit':
      return (
        <div className="step">
          <span className="dot" />
          <span className="label">编辑</span>
          <span className="detail">{baseName(item.path)}</span>
        </div>
      );

    case 'agent':
      return (
        <div className="step">
          <span className="dot" />
          <span className="label">{item.description}</span>
          <span className="detail">{item.state}</span>
        </div>
      );

    default:
      return null;
  }
}

function PermissionCard({
  toolName,
  input,
  onAnswer,
}: {
  toolName: string;
  input: unknown;
  onAnswer: (allow: boolean) => void;
}) {
  return (
    <div className="permission">
      <div className="permission-head">
        <span>允许使用</span>
        <span className="tool">{toolName}</span>
        <span>？</span>
      </div>
      <div className="permission-body">
        <pre className="permission-code">{permissionPreview(toolName, input)}</pre>
      </div>
      <div className="permission-actions">
        <button className="btn ghost" onClick={() => onAnswer(false)}>
          拒绝
        </button>
        <button className="btn primary" onClick={() => onAnswer(true)}>
          允许
        </button>
      </div>
    </div>
  );
}

function EmptyState({ folder }: { folder: string | null }) {
  return (
    <div className="empty">
      <h1>今天想构建什么？</h1>
      <p>
        {folder === null
          ? '打开一个文件夹，把工作交给智能体——它会读代码、改文件、跑测试。'
          : '说说你想做什么。它会读代码、改文件、跑测试，然后把结果告诉你。'}
      </p>
      <div className="suggestions">
        <button className="suggestion">解释这个项目的架构</button>
        <button className="suggestion">修复失败的测试</button>
        <button className="suggestion">给这个函数补单元测试</button>
      </div>
    </div>
  );
}

/** The change summary, once the agent has touched anything. */
function Changes({ session }: { session: SessionView }) {
  const edits = [...session.transcript.edits.values()];
  if (edits.length === 0) return null;
  const added = edits.reduce((sum, edit) => sum + (edit.added ?? 0), 0);
  const removed = edits.reduce((sum, edit) => sum + (edit.removed ?? 0), 0);
  return (
    <div className="changes">
      <span className="count">已更改 {edits.length} 个文件</span>
      <span className="stat">
        <span className="add">+{added}</span> <span className="del">−{removed}</span>
      </span>
      <span className="spacer" />
      <button className="btn ghost">全部撤销</button>
      <button className="btn primary">全部保留</button>
    </div>
  );
}

function Composer({ session }: { session: SessionView }) {
  const [text, setText] = useState('');
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const busy = session.transcript.activeTurnId !== null;

  useEffect(() => {
    const element = areaRef.current;
    if (element === null) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 200)}px`;
  }, [text]);

  const submit = () => {
    const value = text.trim();
    if (value.length === 0) return;
    session.send(value);
    setText('');
  };

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          ref={areaRef}
          className="composer-input"
          rows={1}
          value={text}
          spellCheck={false}
          placeholder="规划、搜索、构建任何内容 · 拖入或粘贴文件 / 命令"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <div className="composer-row">
          <button className="chip">
            ∞ 智能体 <span className="caret-down">▾</span>
          </button>
          <button className="chip">
            <span className="accent">⚿</span> 完全访问 <span className="caret-down">▾</span>
          </button>
          <button className="chip">
            ⚡ DeepSeek <span className="caret-down">▾</span>
          </button>
          <span className="composer-spacer" />
          {busy ? (
            <button className="chip" onClick={session.interrupt}>
              停止
            </button>
          ) : null}
          <button
            className="send"
            disabled={text.trim().length === 0}
            onClick={submit}
            title="发送"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

function ComposerFoot({ session }: { session: SessionView }) {
  const usage = session.transcript.lastUsage;
  const used = usage === null ? 0 : usage.input_tokens + (usage.cache_read_input_tokens ?? 0);
  return (
    <div className="composer-foot">
      <span className="branch">⎇ master ▾</span>
      <span className="spacer" />
      <span className="context-meter">
        {formatTokens(used)} / {session.transcript.contextWindow === null ? '1M' : formatTokens(session.transcript.contextWindow)}
      </span>
    </div>
  );
}

function StatusBar({
  info,
  session,
  onChanged,
}: {
  info: AppInfo | null;
  session: SessionView;
  onChanged: () => void;
}) {
  const [progress, setProgress] = useState<CliProgress | null>(null);
  const [installing, setInstalling] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (info !== null) setMissing(info.cli === null);
  }, [info]);

  useEffect(() => {
    let off: (() => void) | null = null;
    onCliProgress((next) => {
      setProgress(next);
      if (next.kind === 'done') {
        setInstalling(false);
        setMissing(false);
      }
    }).then((unlisten) => {
      off = unlisten;
    });
    return () => off?.();
  }, []);

  const install = () => {
    setInstalling(true);
    invoke('install_cli')
      .then(() => {
        onChanged();
        setMissing(false);
      })
      .catch(() => setInstalling(false))
      .finally(() => setInstalling(false));
  };

  const percent =
    progress !== null && progress.total > 0
      ? Math.min(100, Math.round((progress.soFar / progress.total) * 100))
      : 0;

  return (
    <>
      {missing || installing ? (
        <div className="banner">
          {installing ? <span className="spinner" /> : null}
          <span className="grow">
            {installing
              ? progress?.kind === 'unpacking'
                ? '正在解包 Claude Code…'
                : `正在获取 Claude Code… ${percent}%`
              : '没有找到 Claude Code。'}
          </span>
          {installing ? (
            <div className="progress">
              <div style={{ width: `${percent}%` }} />
            </div>
          ) : (
            <button className="btn primary" onClick={install}>
              下载
            </button>
          )}
        </div>
      ) : null}

      <footer className="statusbar">
        <span className="status-item">
          {session.connection === 'ready'
            ? '已连接'
            : session.connection === 'starting'
              ? '启动中…'
              : session.connection === 'failed'
                ? '未连接'
                : '空闲'}
        </span>
        {session.reason !== null ? (
          <span className="status-item warn" title={session.reason}>
            {session.reason}
          </span>
        ) : null}
        <span className="spacer" />
        <span className="status-item">
          {typeof window === 'undefined'
            ? ''
            : `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio} dpr`}
        </span>
        <span className="status-item">{info?.cliVersion ?? 'Claude Code 未安装'}</span>
        <span className="status-item" title={info?.dataDir ?? ''}>
          {info?.dataDir ?? ''}
        </span>
      </footer>
    </>
  );
}

export function baseName(path: string): string {
  const parts = path.split(/[\\/]/).filter((part) => part.length > 0);
  return parts[parts.length - 1] ?? path;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1000) return `${Math.round(count / 1000)}K`;
  return `${count}`;
}
