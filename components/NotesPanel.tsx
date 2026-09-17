"use client";

import { useId, useMemo, useState } from "react";
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
  const headingId = useId();
  const focusRing =
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";

  return (
    <section
      aria-labelledby={headingId}
      className="flex h-full flex-col bg-white dark:bg-slate-900"
    >
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2
          id={headingId}
          className="text-sm font-semibold text-slate-800 dark:text-slate-200"
        >
          Notes
        </h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
          aria-label="Search notes"
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-400"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {grouped.length === 0 && (
          <p className="px-2 py-4 text-sm text-slate-500 dark:text-slate-400">
            No notes yet. Add one from any prompt to start a folder.
          </p>
        )}

        {grouped.map(([folder, items], index) => (
          <div key={folder} className="mb-2">
            <div className="flex items-center gap-1 px-2">
              <button
                type="button"
                onClick={() => toggleFolder(folder)}
                aria-expanded={!collapsed.has(folder)}
                aria-controls={`${headingId}-folder-${index}`}
                className={`flex flex-1 items-center gap-2 rounded py-1 text-left text-sm font-medium text-slate-700 dark:text-slate-300 ${focusRing}`}
              >
                <span className="text-xs text-slate-500" aria-hidden="true">
                  {collapsed.has(folder) ? "▸" : "▾"}
                </span>
                <span className="truncate">{folder}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="sr-only">, </span>
                  {items.length}
                  <span className="sr-only">
                    {items.length === 1 ? " note" : " notes"}
                  </span>
                </span>
              </button>
              {folder !== UNFILED && (
                <button
                  type="button"
                  onClick={() => {
                    const next = prompt("Rename folder", folder);
                    if (next && next.trim() && next.trim() !== folder) {
                      onRenameFolder(folder, next.trim());
                    }
                  }}
                  className={`rounded px-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 ${focusRing}`}
                  aria-label={`Rename folder ${folder}`}
                >
                  Rename
                </button>
              )}
            </div>

            {!collapsed.has(folder) && (
              <ul
                id={`${headingId}-folder-${index}`}
                aria-label={`Notes in ${folder}`}
                className="space-y-1 py-1"
              >
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
                      type="button"
                      onClick={() => onSelectNode(note.nodeId)}
                      aria-label={`Go to prompt: ${promptByNode.get(note.nodeId) ?? "deleted prompt"}`}
                      className={`block w-full rounded text-left ${focusRing}`}
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
                        className={`rounded border border-slate-300 bg-white px-1 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 ${focusRing}`}
                        aria-label="Move note to folder"
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
                        type="button"
                        onClick={() => onEditNote(note)}
                        aria-label="Edit note"
                        className={`rounded px-1 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 ${focusRing}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteNote(note._id)}
                        aria-label="Delete note"
                        className={`rounded px-1 text-xs text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 ${focusRing}`}
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
    </section>
  );
}
