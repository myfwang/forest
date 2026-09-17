"use client";

import { useMemo, useState } from "react";
import { Doc, Id } from "@/convex/_generated/dataModel";

const UNFILED = "Unfiled";

interface NotesPanelProps {
  notes: Doc<"notes">[];
  nodes: Doc<"nodes">[];
  folders: string[];
  selectedNodeId: Id<"nodes"> | null;
  onSelectNode: (nodeId: Id<"nodes">) => void;
  onEditNote: (note: Doc<"notes">) => void;
  onDeleteNote: (noteId: Id<"notes">) => void;
  onMoveNote: (noteId: Id<"notes">, folder: string | undefined) => void;
  onRenameFolder: (from: string, to: string) => void;
}

export function NotesPanel({
  notes,
  nodes,
  folders,
  selectedNodeId,
  onSelectNode,
  onEditNote,
  onDeleteNote,
  onMoveNote,
  onRenameFolder,
}: NotesPanelProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const promptByNode = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) map.set(node._id, node.userPrompt);
    return map;
  }, [nodes]);

  const grouped = useMemo(() => {
    const term = query.trim().toLowerCase();
    const groups = new Map<string, Doc<"notes">[]>();
    for (const folder of folders) groups.set(folder, []);
    groups.set(UNFILED, groups.get(UNFILED) ?? []);

    for (const note of notes) {
      if (
        term &&
        !note.content.toLowerCase().includes(term) &&
        !(promptByNode.get(note.nodeId) ?? "").toLowerCase().includes(term)
      ) {
        continue;
      }
      const key = note.folder ?? UNFILED;
      const bucket = groups.get(key);
      if (bucket) bucket.push(note);
      else groups.set(key, [note]);
    }

    return [...groups.entries()]
      .filter(([name, items]) => items.length > 0 || name !== UNFILED)
      .sort(([a], [b]) => {
        if (a === UNFILED) return 1;
        if (b === UNFILED) return -1;
        return a.localeCompare(b);
      });
  }, [folders, notes, promptByNode, query]);

  const toggleFolder = (name: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const folderOptions = [...new Set([...folders, UNFILED])];

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Notes
        </h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {grouped.length === 0 && (
          <p className="px-2 py-4 text-sm text-slate-500 dark:text-slate-400">
            No notes yet. Add one from any prompt to start a folder.
          </p>
        )}

        {grouped.map(([folder, items]) => (
          <div key={folder} className="mb-2">
            <div className="flex items-center gap-1 px-2">
              <button
                onClick={() => toggleFolder(folder)}
                className="flex flex-1 items-center gap-2 py-1 text-left text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                <span className="text-xs text-slate-400">
                  {collapsed.has(folder) ? "▸" : "▾"}
                </span>
                <span className="truncate">{folder}</span>
                <span className="text-xs text-slate-400">{items.length}</span>
              </button>
              {folder !== UNFILED && (
                <button
                  onClick={() => {
                    const next = prompt("Rename folder", folder);
                    if (next && next.trim() && next.trim() !== folder) {
                      onRenameFolder(folder, next.trim());
                    }
                  }}
                  className="rounded px-1 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  title="Rename folder"
                >
                  Rename
                </button>
              )}
            </div>

            {!collapsed.has(folder) && (
              <ul className="space-y-1 py-1">
                {items.map((note) => (
                  <li
                    key={note._id}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      note.nodeId === selectedNodeId
                        ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <button
                      onClick={() => onSelectNode(note.nodeId)}
                      className="block w-full text-left"
                    >
                      <p className="line-clamp-3 whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                        {note.content}
                      </p>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                        on: {promptByNode.get(note.nodeId) ?? "deleted prompt"}
                      </p>
                    </button>
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        value={note.folder ?? UNFILED}
                        onChange={(e) =>
                          onMoveNote(
                            note._id,
                            e.target.value === UNFILED
                              ? undefined
                              : e.target.value,
                          )
                        }
                        className="rounded border border-slate-300 bg-white px-1 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        title="Folder"
                      >
                        {[
                          ...new Set([
                            ...folderOptions,
                            note.folder ?? UNFILED,
                          ]),
                        ].map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => onEditNote(note)}
                        className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDeleteNote(note._id)}
                        className="text-xs text-slate-500 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
