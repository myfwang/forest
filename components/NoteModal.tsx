"use client";

import { useState } from "react";

interface NoteModalProps {
  onClose: () => void;
  onSave: (content: string) => void | Promise<void>;
  initialContent?: string;
  nodePrompt?: string;
}

/**
 * Remount this (via `key`) when the target note changes so the textarea picks
 * up the new content.
 */
export function NoteModal({
  onClose,
  onSave,
  initialContent = "",
  nodePrompt,
}: NoteModalProps) {
  const [content, setContent] = useState(initialContent);

  const handleSave = () => {
    if (!content.trim()) return;
    void onSave(content);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl dark:bg-slate-800">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
            {initialContent ? "Edit note" : "Add note"}
          </h2>
          {nodePrompt && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
              For: {nodePrompt}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
            }}
            placeholder="Why does this branch matter?"
            className="h-48 w-full resize-none rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!content.trim()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save note
          </button>
        </div>
      </div>
    </div>
  );
}
