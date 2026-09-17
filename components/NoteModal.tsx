"use client";

import { useEffect, useId, useRef, useState } from "react";

interface NoteModalProps {
  onClose: () => void;
  onSave: (content: string, folder: string) => void | Promise<void>;
  initialContent?: string;
  initialFolder?: string;
  folders?: string[];
  nodePrompt?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Remount this (via `key`) when the target note changes so the textarea picks
 * up the new content.
 */
export function NoteModal({
  onClose,
  onSave,
  initialContent = "",
  initialFolder = "",
  folders = [],
  nodePrompt,
}: NoteModalProps) {
  const [content, setContent] = useState(initialContent);
  const [folder, setFolder] = useState(initialFolder);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const datalistId = useId();

  // Return focus to whatever opened the modal when it unmounts.
  useEffect(() => {
    const opener = document.activeElement;
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  const handleSave = () => {
    if (!content.trim()) return;
    void onSave(content, folder);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;

    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (
      e.shiftKey &&
      (active === first || !dialogRef.current.contains(active))
    ) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={nodePrompt ? descriptionId : undefined}
        onKeyDown={handleKeyDown}
        className="relative flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl dark:bg-slate-800"
      >
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h2
            id={titleId}
            className="text-xl font-semibold text-slate-800 dark:text-slate-200"
          >
            {initialContent ? "Edit note" : "Add note"}
          </h2>
          {nodePrompt && (
            <p
              id={descriptionId}
              className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400"
            >
              For: {nodePrompt}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            <span className="sr-only">Note</span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Why does this branch matter?"
              className="h-48 w-full resize-none rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-400"
              autoFocus
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Folder
            <input
              type="text"
              value={folder}
              list={datalistId}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="Unfiled"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-400"
            />
          </label>
          <datalist id={datalistId}>
            {folders.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!content.trim()}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-800"
          >
            Save note
          </button>
        </div>
      </div>
    </div>
  );
}
