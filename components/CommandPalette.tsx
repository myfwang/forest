"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface CommandItem {
  id: string;
  /** Section header the item is grouped under, e.g. "Trees". */
  group: string;
  label: string;
  /** Secondary text shown after the label, also matched when filtering. */
  hint?: string;
  /** Keyboard shortcut rendered on the right edge. */
  shortcut?: string;
  run: () => void;
}

interface CommandPaletteProps {
  items: CommandItem[];
  onClose: () => void;
}

const MAX_RESULTS = 40;

function matches(item: CommandItem, needle: string): boolean {
  if (!needle) return true;
  const haystack = `${item.group} ${item.label} ${item.hint ?? ""}`
    .toLowerCase()
    .replace(/\s+/g, " ");
  return needle.split(" ").every((word) => haystack.includes(word));
}

/**
 * Filterable list of commands. The parent decides when it is mounted; this
 * component owns focus while open and hands it back on close.
 */
export function CommandPalette({ items, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/\s+/g, " ");
    return items.filter((item) => matches(item, needle)).slice(0, MAX_RESULTS);
  }, [items, query]);

  useEffect(() => {
    previousFocus.current = document.activeElement;
    inputRef.current?.focus();
    const dialog = dialogRef.current;
    return () => {
      // Hand focus back unless the chosen command already moved it.
      const active = document.activeElement;
      const focusIsLoose =
        active === null ||
        active === document.body ||
        (dialog?.contains(active) ?? false);
      if (focusIsLoose && previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus();
      }
    };
  }, []);

  const currentIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));

  useEffect(() => {
    const option = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${currentIndex}"]`,
    );
    option?.scrollIntoView({ block: "nearest" });
  }, [currentIndex, results]);

  const select = (item: CommandItem | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        onClose();
        break;
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) =>
          results.length ? (i - 1 + results.length) % results.length : 0,
        );
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(Math.max(results.length - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        select(results[currentIndex]);
        break;
      case "Tab":
        // Single focusable control, so keep focus inside the dialog.
        e.preventDefault();
        break;
    }
  };

  const activeId = results[currentIndex]
    ? `command-option-${results[currentIndex].id}`
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-slate-800"
        onKeyDown={handleKeyDown}
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-list"
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          placeholder="Jump to a tree, garden, prompt or note, or run an action…"
          className="border-b border-slate-200 bg-transparent px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
        />

        <ul
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          className="flex-1 overflow-y-auto py-2"
        >
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No matches
            </li>
          )}
          {results.map((item, index) => {
            const showGroup =
              index === 0 || item.group !== results[index - 1].group;
            const isActive = index === currentIndex;
            return (
              <li key={item.id} role="presentation">
                {showGroup && (
                  <div className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {item.group}
                  </div>
                )}
                <div
                  id={`command-option-${item.id}`}
                  role="option"
                  aria-selected={isActive}
                  data-index={index}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => select(item)}
                  className={`mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                    isActive
                      ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {item.hint && (
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-500 dark:text-slate-400">
                      {item.hint}
                    </span>
                  )}
                  {item.shortcut && (
                    <kbd className="ml-auto flex-shrink-0 rounded border border-slate-300 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:border-slate-600 dark:text-slate-400">
                      {item.shortcut}
                    </kbd>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex gap-4 border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <span>
            <kbd className="font-mono">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="font-mono">↵</kbd> select
          </span>
          <span>
            <kbd className="font-mono">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
