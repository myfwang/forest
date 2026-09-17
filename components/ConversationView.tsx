"use client";

import { Doc, Id } from "@/convex/_generated/dataModel";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { childrenByParent, NodeDoc, siblingsOf } from "@/lib/tree";

// A generation with no database write for this long is assumed dead.
const STALL_AFTER_MS = 30_000;

function isGenerating(node: NodeDoc): boolean {
  return (
    node.aiResponseStatus === "pending" || node.aiResponseStatus === "streaming"
  );
}

function isStalled(node: NodeDoc, now: number): boolean {
  if (!isGenerating(node)) return false;
  const lastUpdate = node.generationUpdatedAt ?? node.createdAt;
  return now - lastUpdate > STALL_AFTER_MS;
}

interface ConversationViewProps {
  nodes: NodeDoc[];
  path: NodeDoc[];
  notes: Doc<"notes">[];
  selectedNodeId: Id<"nodes"> | null;
  onSelectNode: (nodeId: Id<"nodes">) => void;
  onRevise: (nodeId: Id<"nodes">, prompt: string) => Promise<void>;
  onRegenerate: (nodeId: Id<"nodes">) => Promise<void>;
  onRetryGeneration: (nodeId: Id<"nodes">) => Promise<void>;
  onCancelGeneration: (nodeId: Id<"nodes">) => Promise<void>;
  onAddNote: (nodeId: Id<"nodes">) => void;
  onEditNote: (note: Doc<"notes">) => void;
  onDeleteNote: (noteId: Id<"notes">) => void;
  onDeleteNode: (nodeId: Id<"nodes">) => void;
}

export function ConversationView({
  nodes,
  path,
  notes,
  selectedNodeId,
  onSelectNode,
  onRevise,
  onRegenerate,
  onRetryGeneration,
  onCancelGeneration,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onDeleteNode,
}: ConversationViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [revisingNodeId, setRevisingNodeId] = useState<Id<"nodes"> | null>(
    null,
  );
  const [revisedPrompt, setRevisedPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const lastNodeId = path.length > 0 ? path[path.length - 1]._id : null;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastNodeId]);

  // Re-render on a timer while something is generating so a node that stops
  // receiving writes is flagged as stalled without any further server event.
  const [now, setNow] = useState(() => Date.now());
  const anyGenerating = path.some(isGenerating);
  useEffect(() => {
    if (!anyGenerating) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [anyGenerating]);

  const children = childrenByParent(nodes);

  const startRevision = (node: NodeDoc) => {
    setRevisingNodeId(node._id);
    setRevisedPrompt(node.userPrompt);
  };

  const submitRevision = async (nodeId: Id<"nodes">) => {
    if (!revisedPrompt.trim() || busy) return;
    setBusy(true);
    try {
      await onRevise(nodeId, revisedPrompt);
      setRevisingNodeId(null);
      setRevisedPrompt("");
    } finally {
      setBusy(false);
    }
  };

  if (path.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
          Pick a prompt in the map to read that branch.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
      {path.map((node) => {
        const siblings = siblingsOf(nodes, node);
        const siblingIndex = siblings.findIndex((s) => s._id === node._id);
        const nodeNotes = notes.filter((note) => note.nodeId === node._id);
        const isSelected = node._id === selectedNodeId;
        const nextBranches = children.get(node._id) ?? [];
        const stalled = isStalled(node, now);

        return (
          <div
            key={node._id}
            className={`rounded-xl border transition-colors ${
              isSelected
                ? "border-emerald-400 dark:border-emerald-600"
                : "border-slate-200 dark:border-slate-800"
            }`}
          >
            {/* Prompt */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    You
                  </span>
                  {siblings.length > 1 && (
                    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <button
                        onClick={() =>
                          onSelectNode(
                            siblings[
                              (siblingIndex - 1 + siblings.length) %
                                siblings.length
                            ]._id,
                          )
                        }
                        className="px-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Previous version of this prompt"
                      >
                        ‹
                      </button>
                      <span>
                        version {siblingIndex + 1}/{siblings.length}
                      </span>
                      <button
                        onClick={() =>
                          onSelectNode(
                            siblings[(siblingIndex + 1) % siblings.length]._id,
                          )
                        }
                        className="px-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Next version of this prompt"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <button
                    onClick={() => startRevision(node)}
                    className="px-2 py-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Revise
                  </button>
                  <button
                    onClick={() => void onRegenerate(node._id)}
                    className="px-2 py-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => onAddNote(node._id)}
                    className="px-2 py-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Note
                  </button>
                  <button
                    onClick={() => onDeleteNode(node._id)}
                    className="px-2 py-1 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {revisingNodeId === node._id ? (
                <div className="space-y-2">
                  <textarea
                    value={revisedPrompt}
                    onChange={(e) => setRevisedPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void submitRevision(node._id);
                      }
                      if (e.key === "Escape") setRevisingNodeId(null);
                    }}
                    rows={4}
                    autoFocus
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void submitRevision(node._id)}
                      disabled={busy || !revisedPrompt.trim()}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
                    >
                      Send as new version
                    </button>
                    <button
                      onClick={() => setRevisingNodeId(null)}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      Cancel
                    </button>
                    <span className="text-xs text-slate-400">
                      The original wording and its replies are kept.
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => onSelectNode(node._id)}
                  className="text-left w-full text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap"
                >
                  {node.userPrompt}
                </button>
              )}
            </div>

            {/* Response */}
            <div className="p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Assistant
                </span>
                {node.aiResponseStatus === "streaming" && !stalled && (
                  <button
                    onClick={() => void onCancelGeneration(node._id)}
                    disabled={node.cancelRequested === true}
                    className="px-2 py-1 rounded text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    {node.cancelRequested ? "Stopping…" : "Stop"}
                  </button>
                )}
              </div>
              <div className="markdown mt-2 text-sm text-slate-800 dark:text-slate-200">
                {node.aiResponseStatus === "error" ? (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {node.aiErrorMessage ?? "Generation failed."}
                  </p>
                ) : stalled ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {node.aiResponse && (
                      <div className="w-full">
                        <ReactMarkdown>{node.aiResponse}</ReactMarkdown>
                      </div>
                    )}
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Generation stalled — the model stopped responding.
                    </p>
                    <button
                      onClick={() => void onRetryGeneration(node._id)}
                      className="px-2 py-1 rounded border border-amber-300 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                    >
                      Retry generation
                    </button>
                  </div>
                ) : node.aiResponse ? (
                  <>
                    <ReactMarkdown>{node.aiResponse}</ReactMarkdown>
                    {node.aiResponseStatus === "cancelled" && (
                      <p className="mt-2 text-xs text-slate-400">
                        Stopped before the answer was finished.
                      </p>
                    )}
                  </>
                ) : node.aiResponseStatus === "cancelled" ? (
                  <p className="text-sm text-slate-400">
                    Stopped before the model answered.
                  </p>
                ) : (
                  <p className="text-sm text-slate-400">
                    {node.aiResponseStatus === "pending"
                      ? "Waiting for the model…"
                      : "Generating…"}
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            {nodeNotes.length > 0 && (
              <div className="px-4 pb-4 space-y-2">
                {nodeNotes.map((note) => (
                  <div
                    key={note._id}
                    className="group flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2"
                  >
                    <p className="flex-1 text-xs text-amber-900 dark:text-amber-100 whitespace-pre-wrap">
                      {note.content}
                    </p>
                    <button
                      onClick={() => onEditNote(note)}
                      className="text-xs text-amber-700 dark:text-amber-300 opacity-60 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteNote(note._id)}
                      className="text-xs text-red-600 dark:text-red-400 opacity-60 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Branches continuing from here that are not on this path */}
            {nextBranches.length > 1 && (
              <div className="px-4 pb-4 flex flex-wrap gap-2">
                {nextBranches.map((branch, index) => {
                  const onPath = path.some((n) => n._id === branch._id);
                  return (
                    <button
                      key={branch._id}
                      onClick={() => onSelectNode(branch._id)}
                      className={`text-xs px-2 py-1 rounded-full border max-w-[220px] truncate ${
                        onPath
                          ? "border-emerald-400 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                          : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                      title={branch.userPrompt}
                    >
                      branch {index + 1}: {branch.userPrompt}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
