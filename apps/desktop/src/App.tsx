import { useEffect, useState } from 'react';
import { invoke, type AppInfo } from './ipc.js';

/**
 * The window's skeleton: the side bar of projects and conversations, the
 * conversation, and the panel below it.
 *
 * At this stage nothing is wired to the agent: the shell is here to be
 * measured (first paint, memory) and to fix the layout the rest is built
 * into.
 */
export default function App() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [info, setInfo] = useState<AppInfo | null>(null);

  // The shell answers with the data directory, which the status bar shows:
  // it is where sessions, snapshots and logs live, and users do look for it.
  useEffect(() => {
    invoke('app_info').then(setInfo).catch(() => setInfo(null));
  }, []);

  return (
    <div className="shell">
      <TitleBar />
      <div className="body">
        <Sidebar />
        <main className="main">
          <div className="conversation">
            <EmptyState />
          </div>
          {panelOpen ? <Panel onClose={() => setPanelOpen(false)} /> : null}
          <Composer />
        </main>
      </div>
      <StatusBar
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((open) => !open)}
        info={info}
      />
    </div>
  );
}

function TitleBar() {
  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="brand">
        <span className="mark" aria-hidden="true" />
        <span className="brand-name">灵动极客</span>
        <span className="brand-latin">AgileGeek</span>
      </div>
      <div className="titlebar-actions">
        <span className="pill">Windows · 0.1.0</span>
      </div>
    </header>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="sidebar-title">项目</span>
        <button className="icon-button" title="新建对话" aria-label="新建对话">
          +
        </button>
      </div>
      <nav className="projects">
        <div className="project">
          <span className="project-name">还没有添加项目</span>
          <span className="project-hint">打开一个文件夹开始</span>
        </div>
      </nav>
      <div className="sidebar-foot">
        <button className="ghost-button">设置</button>
      </div>
    </aside>
  );
}

function EmptyState() {
  return (
    <div className="empty">
      <div className="halo" aria-hidden="true" />
      <h1>
        今天想构建<span className="accent">什么</span>？
      </h1>
      <p>把一个文件夹交给智能体，它会读代码、改文件、跑测试，然后告诉你结果。</p>
      <div className="suggestions">
        <button className="suggestion">解释这个项目的架构</button>
        <button className="suggestion">修复失败的测试</button>
        <button className="suggestion">给这个函数补单元测试</button>
      </div>
    </div>
  );
}

function Panel({ onClose }: { onClose: () => void }) {
  return (
    <section className="panel">
      <header className="panel-head">
        <span>终端</span>
        <button className="icon-button" onClick={onClose} aria-label="关闭面板">
          ×
        </button>
      </header>
      <div className="panel-body">
        <code className="prompt-line">
          <span className="prompt-sign">PS&gt;</span> 面板会在下一步接上伪终端
        </code>
      </div>
    </section>
  );
}

function Composer() {
  return (
    <div className="composer">
      <div className="composer-box">
        <textarea
          className="composer-input"
          rows={1}
          placeholder="描述你要做的事，@ 提到文件，/ 使用命令"
          spellCheck={false}
        />
        <div className="composer-row">
          <div className="composer-chips">
            <span className="chip chip-brand">DeepSeek</span>
            <span className="chip">默认权限</span>
          </div>
          <button className="send" disabled>
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBar({
  panelOpen,
  onTogglePanel,
  info,
}: {
  panelOpen: boolean;
  onTogglePanel: () => void;
  info: AppInfo | null;
}) {
  return (
    <footer className="statusbar">
      <button className="status-item" onClick={onTogglePanel}>
        {panelOpen ? '隐藏面板' : '显示面板'}
      </button>
      <span className="spacer" />
      <span className="status-item" title={info?.dataDir ?? ''}>
        {info === null ? '未连接' : `v${info.version}`}
      </span>
      <span className="status-item">UTF-8</span>
    </footer>
  );
}
