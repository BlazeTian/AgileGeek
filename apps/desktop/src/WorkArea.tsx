import { useEffect, useState } from 'react';
import { invoke, type FsEntry } from './ipc.js';

type Entry = FsEntry;

interface Tab {
  id: 'files' | 'terminal' | 'usage' | 'plan';
  label: string;
}

const TABS: Tab[] = [
  { id: 'files', label: '文件' },
  { id: 'terminal', label: '终端' },
  { id: 'usage', label: '用量' },
  { id: 'plan', label: '计划' },
];

/**
 * The right column: a file tree and the file that is open.
 *
 * Reading the tree goes through the shell, so it is the same call whether
 * the files are local or (later) on another machine.
 */
export function WorkArea({ folder, width }: { folder: string | null; width: number }) {
  const [tab, setTab] = useState<Tab['id']>('files');
  const [tree, setTree] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (folder === null) {
      setTree([]);
      return;
    }
    invoke('fs_list', { path: folder })
      .then(setTree)
      .catch(() => setTree([]));
  }, [folder]);

  return (
    <aside className="work" style={{ width }}>
      <div className="tabs">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            className={`tab ${tab === entry.id ? 'active' : ''}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
            {entry.id === 'files' && tree.length > 0 ? (
              <span className="badge">{tree.length}</span>
            ) : null}
          </button>
        ))}
        <span className="spacer" />
        <button className="icon-button" title="关闭">
          ×
        </button>
      </div>

      <div className="work-body">
        {tab === 'files' ? (
          <>
            <div className="tree">
              {folder === null ? (
                <div className="placeholder">还没有打开项目</div>
              ) : (
                tree.map((entry) => (
                  <TreeRow
                    key={entry.path}
                    entry={entry}
                    depth={0}
                    selected={selected}
                    onSelect={setSelected}
                  />
                ))
              )}
            </div>
            <div className="editor">
              {selected === null ? (
                <div className="placeholder">
                  <div>从左侧选择一个文件</div>
                  <div style={{ fontSize: 12 }}>编辑器在下一步接上</div>
                </div>
              ) : (
                <>
                  <div className="editor-tabs">
                    <span className="editor-tab active">
                      {baseName(selected)}
                      <span className="close">×</span>
                    </span>
                  </div>
                  <div className="editor-body">
                    <div className="placeholder">
                      <div>{selected}</div>
                      <div style={{ fontSize: 12 }}>内容预览在下一步接上</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="placeholder">
            {TABS.find((entry) => entry.id === tab)?.label}在后面的里程碑里
          </div>
        )}
      </div>
    </aside>
  );
}

function TreeRow({
  entry,
  depth,
  selected,
  onSelect,
}: {
  entry: Entry;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  return (
    <>
      <button
        className={`tree-row ${selected === entry.path ? 'selected' : ''}`}
        style={{ paddingLeft: 6 + depth * 12 }}
        onClick={() => {
          if (entry.isDir) setOpen((value) => !value);
          else onSelect(entry.path);
        }}
      >
        <span className="chev">{entry.isDir ? (open ? '▾' : '▸') : ''}</span>
        <span className="name">{entry.name}</span>
      </button>
      {entry.isDir && open
        ? (entry.children ?? []).map((child) => (
            <TreeRow
              key={child.path}
              entry={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))
        : null}
    </>
  );
}

function baseName(path: string): string {
  const parts = path.split(/[\\/]/).filter((part) => part.length > 0);
  return parts[parts.length - 1] ?? path;
}
