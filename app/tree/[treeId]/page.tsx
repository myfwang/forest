"use client";

import { useAction, useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useEffect, useMemo, useState, use } from "react";
import { TreeSidebar } from "@/components/TreeSidebar";
import { TreeGraph } from "@/components/TreeGraph";
import { NoteModal } from "@/components/NoteModal";
import { ConversationView } from "@/components/ConversationView";
import { latestLeaf, pathToNode } from "@/lib/tree";
import { useRouter } from "next/navigation";

export default function TreePage({
  params,
}: {
  params: Promise<{ treeId: Id<"trees"> }>;
}) {
  const resolvedParams = use(params);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  const data = useQuery(api.trees.getTreeWithNodes, {
    treeId: resolvedParams.treeId,
  });
  const notes = useQuery(api.notes.getNotesForTree, {
    treeId: resolvedParams.treeId,
  });
  const gardenData = useQuery(api.gardens.listGardens, {});

  const createBranch = useMutation(api.nodes.createBranch);
  const reviseNode = useMutation(api.nodes.reviseNode);
  const regenerateNode = useMutation(api.nodes.regenerateNode);
  const setNodePosition = useMutation(api.nodes.setNodePosition);
  const deleteNode = useMutation(api.nodes.deleteNode);
  const generateResponse = useAction(api.ai.generateResponse);
  const updateTreeTitle = useMutation(api.trees.updateTreeTitle);
  const moveTreeToGarden = useMutation(api.gardens.moveTreeToGarden);
  const createNote = useMutation(api.notes.createNote);
  const updateNote = useMutation(api.notes.updateNote);
  const deleteNote = useMutation(api.notes.deleteNote);

  const [selectedNodeId, setSelectedNodeId] = useState<Id<"nodes"> | null>(
    null,
  );
  const [branchPrompt, setBranchPrompt] = useState("");
  const [isBranching, setIsBranching] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [showMap, setShowMap] = useState(true);
  const [noteTarget, setNoteTarget] = useState<{
    nodeId: Id<"nodes">;
    note?: Doc<"notes">;
  } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/signin");
  }, [isAuthenticated, isLoading, router]);

  const nodes = useMemo(() => data?.nodes ?? [], [data?.nodes]);

  // Land on wherever the conversation was last extended.
  useEffect(() => {
    if (selectedNodeId && nodes.some((node) => node._id === selectedNodeId)) {
      return;
    }
    const leaf = latestLeaf(nodes);
    setSelectedNodeId(leaf?._id ?? null);
  }, [nodes, selectedNodeId]);

  const currentPath = useMemo(
    () => pathToNode(nodes, selectedNodeId),
    [nodes, selectedNodeId],
  );

  const noteCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes ?? []) {
      counts.set(note.nodeId, (counts.get(note.nodeId) ?? 0) + 1);
    }
    return counts;
  }, [notes]);

  if (isLoading) {
    return (
      <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-1 items-center justify-center">
          <LoadingState />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (!data) {
    return (
      <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
        <TreeSidebar />
        <div className="flex flex-1 items-center justify-center">
          <LoadingState />
        </div>
      </div>
    );
  }

  if (!data.tree) {
    return (
      <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
        <TreeSidebar />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-slate-600 dark:text-slate-400">
            This conversation no longer exists.
          </p>
        </div>
      </div>
    );
  }

  const tree = data.tree;
  const gardens = gardenData?.gardens ?? [];

  const runPrompt = async (nodeId: Id<"nodes">) => {
    setSelectedNodeId(nodeId);
    await generateResponse({ nodeId });
  };

  const handleBranch = async () => {
    if (!branchPrompt.trim() || !selectedNodeId || isBranching) return;
    setIsBranching(true);
    try {
      const { nodeId } = await createBranch({
        parentNodeId: selectedNodeId,
        userPrompt: branchPrompt,
      });
      setBranchPrompt("");
      void runPrompt(nodeId);
    } catch (error) {
      console.error("Failed to create branch:", error);
    } finally {
      setIsBranching(false);
    }
  };

  const handleRevise = async (nodeId: Id<"nodes">, prompt: string) => {
    const result = await reviseNode({ nodeId, userPrompt: prompt });
    void runPrompt(result.nodeId);
  };

  const handleRegenerate = async (nodeId: Id<"nodes">) => {
    const result = await regenerateNode({ nodeId });
    void runPrompt(result.nodeId);
  };

  const handleSaveTitle = async () => {
    if (!editedTitle.trim()) return;
    await updateTreeTitle({ treeId: tree._id, title: editedTitle });
    setIsEditingTitle(false);
  };

  const handleSaveNote = async (content: string) => {
    if (!noteTarget) return;
    if (noteTarget.note) {
      await updateNote({ noteId: noteTarget.note._id, content });
    } else {
      await createNote({ nodeId: noteTarget.nodeId, content });
    }
  };

  const handleDeleteNode = async (nodeId: Id<"nodes">) => {
    if (!confirm("Delete this prompt and everything branching from it?"))
      return;
    try {
      const target = nodes.find((node) => node._id === nodeId);
      await deleteNode({ nodeId });
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(target?.parentNodeId ?? null);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete prompt");
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      <TreeSidebar />

      <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          {isEditingTitle ? (
            <>
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSaveTitle();
                  if (e.key === "Escape") setIsEditingTitle(false);
                }}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                autoFocus
              />
              <button
                onClick={() => void handleSaveTitle()}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditingTitle(false)}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <h1 className="flex-1 truncate text-lg font-semibold text-slate-800 dark:text-slate-200">
                {tree.title}
              </h1>
              <button
                onClick={() => {
                  setEditedTitle(tree.title);
                  setIsEditingTitle(true);
                }}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Rename
              </button>
              <select
                value={tree.gardenId ?? ""}
                onChange={(e) =>
                  void moveTreeToGarden({
                    treeId: tree._id,
                    gardenId:
                      e.target.value === ""
                        ? undefined
                        : (e.target.value as Id<"gardens">),
                  })
                }
                title="Garden (topic)"
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="">Unsorted</option>
                {gardens.map((garden) => (
                  <option key={garden._id} value={garden._id}>
                    {garden.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowMap(!showMap)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                {showMap ? "Hide map" : "Show map"}
              </button>
            </>
          )}
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <ConversationView
              nodes={nodes}
              path={currentPath}
              notes={notes ?? []}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onRevise={handleRevise}
              onRegenerate={handleRegenerate}
              onAddNote={(nodeId) => setNoteTarget({ nodeId })}
              onEditNote={(note) =>
                setNoteTarget({ nodeId: note.nodeId, note })
              }
              onDeleteNote={(noteId) => void deleteNote({ noteId })}
              onDeleteNode={handleDeleteNode}
            />

            <div className="border-t border-slate-200 p-4 dark:border-slate-800">
              <textarea
                value={branchPrompt}
                onChange={(e) => setBranchPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleBranch();
                  }
                }}
                placeholder={
                  selectedNodeId
                    ? "Continue from the selected prompt…"
                    : "Select a prompt first"
                }
                rows={3}
                disabled={isBranching || !selectedNodeId}
                className="w-full resize-none rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Only the highlighted path is sent to the model — earlier
                  branches stay out of context.
                </p>
                <button
                  onClick={() => void handleBranch()}
                  disabled={isBranching || !branchPrompt.trim()}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBranching ? "Growing…" : "Send"}
                </button>
              </div>
            </div>
          </div>

          {showMap && (
            <div className="w-[480px] flex-shrink-0 border-l border-slate-200 dark:border-slate-800">
              <TreeGraph
                nodes={nodes}
                selectedNodeId={selectedNodeId}
                onNodeClick={setSelectedNodeId}
                currentPath={currentPath}
                noteCounts={noteCounts}
                onAddNote={(nodeId) => setNoteTarget({ nodeId })}
                onDeleteNode={handleDeleteNode}
                onMoveNode={(nodeId, x, y) =>
                  void setNodePosition({ nodeId, positionX: x, positionY: y })
                }
              />
            </div>
          )}
        </div>
      </div>

      {noteTarget && (
        <NoteModal
          key={noteTarget.note?._id ?? noteTarget.nodeId}
          onClose={() => setNoteTarget(null)}
          onSave={handleSaveNote}
          initialContent={noteTarget.note?.content ?? ""}
          nodePrompt={
            nodes.find((node) => node._id === noteTarget.nodeId)?.userPrompt
          }
        />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-3 w-3 animate-bounce rounded-full bg-slate-400" />
      <div
        className="h-3 w-3 animate-bounce rounded-full bg-slate-500"
        style={{ animationDelay: "0.1s" }}
      />
      <div
        className="h-3 w-3 animate-bounce rounded-full bg-slate-600"
        style={{ animationDelay: "0.2s" }}
      />
      <p className="ml-2 text-slate-600 dark:text-slate-400">Loading…</p>
    </div>
  );
}
