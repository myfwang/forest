"use client";

import { useAction, useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useEffect, useMemo, useRef, useState, use } from "react";
import { TreeSidebar } from "@/components/TreeSidebar";
import { TreeGraph } from "@/components/TreeGraph";
import { NoteModal } from "@/components/NoteModal";
import { NotesPanel } from "@/components/NotesPanel";
import { ConversationView } from "@/components/ConversationView";
import {
  byId,
  childrenByParent,
  latestLeaf,
  pathToNode,
  siblingsOf,
} from "@/lib/tree";
import { isTypingTarget } from "@/lib/keyboard";
import { CommandItem } from "@/components/CommandPalette";
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
  const folderData = useQuery(api.notes.listFolders, {
    treeId: resolvedParams.treeId,
  });

  const createBranch = useMutation(api.nodes.createBranch);
  const reviseNode = useMutation(api.nodes.reviseNode);
  const regenerateNode = useMutation(api.nodes.regenerateNode);
  const setNodePosition = useMutation(api.nodes.setNodePosition);
  const resetNodePositions = useMutation(api.nodes.resetNodePositions);
  const deleteNode = useMutation(api.nodes.deleteNode);
  const cancelGeneration = useMutation(api.nodes.cancelGeneration);
  const generateResponse = useAction(api.ai.generateResponse);
  const updateTreeTitle = useMutation(api.trees.updateTreeTitle);
  const moveTreeToGarden = useMutation(api.gardens.moveTreeToGarden);
  const createNote = useMutation(api.notes.createNote);
  const updateNote = useMutation(api.notes.updateNote);
  const deleteNote = useMutation(api.notes.deleteNote);
  const moveNoteToFolder = useMutation(api.notes.moveNoteToFolder);
  const renameFolder = useMutation(api.notes.renameFolder);

  const [selectedNodeId, setSelectedNodeId] = useState<Id<"nodes"> | null>(
    null,
  );
  const [branchPrompt, setBranchPrompt] = useState("");
  const [isBranching, setIsBranching] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [showMap, setShowMap] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [noteTarget, setNoteTarget] = useState<{
    nodeId: Id<"nodes">;
    note?: Doc<"notes">;
  } | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

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

  // j/k step across siblings, h goes to the parent, l to the first child.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (!selectedNodeId) return;
      const current = byId(nodes).get(selectedNodeId);
      if (!current) return;

      let next: Id<"nodes"> | undefined;
      switch (e.key) {
        case "j":
        case "k": {
          const siblings = siblingsOf(nodes, current);
          const index = siblings.findIndex((n) => n._id === current._id);
          next = siblings[index + (e.key === "j" ? 1 : -1)]?._id;
          break;
        }
        case "h":
          next = current.parentNodeId;
          break;
        case "l":
          next = childrenByParent(nodes).get(current._id)?.[0]?._id;
          break;
        default:
          return;
      }
      e.preventDefault();
      if (next) setSelectedNodeId(next);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nodes, selectedNodeId]);

  const noteCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes ?? []) {
      counts.set(note.nodeId, (counts.get(note.nodeId) ?? 0) + 1);
    }
    return counts;
  }, [notes]);

  const commands = useMemo<CommandItem[]>(() => {
    const tree = data?.tree;
    if (!tree) return [];
    const lookup = byId(nodes);
    const actions: CommandItem[] = [
      {
        id: "action-branch",
        group: "Actions",
        label: "New branch from selected prompt",
        hint: selectedNodeId
          ? lookup.get(selectedNodeId)?.userPrompt
          : undefined,
        run: () => promptRef.current?.focus(),
      },
      {
        id: "action-toggle-map",
        group: "Actions",
        label: showMap ? "Hide map" : "Show map",
        run: () => setShowMap((value) => !value),
      },
      {
        id: "action-toggle-notes",
        group: "Actions",
        label: showNotes ? "Hide notes panel" : "Show notes panel",
        run: () => setShowNotes((value) => !value),
      },
      {
        id: "action-rename",
        group: "Actions",
        label: "Rename tree",
        hint: tree.title,
        run: () => {
          setEditedTitle(tree.title);
          setIsEditingTitle(true);
        },
      },
    ];
    const nodeItems: CommandItem[] = nodes.map((node) => ({
      id: `node-${node._id}`,
      group: "Prompts in this tree",
      label: node.userPrompt,
      hint: node._id === selectedNodeId ? "selected" : undefined,
      run: () => setSelectedNodeId(node._id),
    }));
    const noteItems: CommandItem[] = (notes ?? []).map((note) => ({
      id: `note-${note._id}`,
      group: "Notes",
      label: note.content,
      hint: note.folder ?? lookup.get(note.nodeId)?.userPrompt,
      run: () => {
        setSelectedNodeId(note.nodeId);
        setNoteTarget({ nodeId: note.nodeId, note });
      },
    }));
    return [...actions, ...nodeItems, ...noteItems];
  }, [data?.tree, nodes, notes, selectedNodeId, showMap, showNotes]);

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
  const folders = (folderData ?? []).map((folder) => folder.name);

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

  const handleSaveNote = async (content: string, folder: string) => {
    if (!noteTarget) return;
    const target = folder.trim() === "" ? undefined : folder.trim();
    if (noteTarget.note) {
      await updateNote({
        noteId: noteTarget.note._id,
        content,
        folder: target,
      });
    } else {
      await createNote({
        nodeId: noteTarget.nodeId,
        content,
        folder: target,
      });
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
      <TreeSidebar commands={commands} />

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
                onClick={() => setShowNotes(!showNotes)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                {showNotes ? "Hide notes" : "Notes"}
              </button>
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
              onRetryGeneration={runPrompt}
              onCancelGeneration={async (nodeId) => {
                await cancelGeneration({ nodeId });
              }}
              onAddNote={(nodeId) => setNoteTarget({ nodeId })}
              onEditNote={(note) =>
                setNoteTarget({ nodeId: note.nodeId, note })
              }
              onDeleteNote={(noteId) => void deleteNote({ noteId })}
              onDeleteNode={handleDeleteNode}
            />

            <div className="border-t border-slate-200 p-4 dark:border-slate-800">
              <textarea
                ref={promptRef}
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
                  branches stay out of context.{" "}
                  <span className="whitespace-nowrap">
                    <kbd className="font-mono">⌘K</kbd> jump ·{" "}
                    <kbd className="font-mono">j/k</kbd> siblings ·{" "}
                    <kbd className="font-mono">h/l</kbd> parent/child
                  </span>
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

          {showNotes && (
            <div className="w-[340px] flex-shrink-0 border-l border-slate-200 dark:border-slate-800">
              <NotesPanel
                notes={notes ?? []}
                nodes={nodes}
                folders={folders}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                onEditNote={(note) =>
                  setNoteTarget({ nodeId: note.nodeId, note })
                }
                onDeleteNote={(noteId) => void deleteNote({ noteId })}
                onMoveNote={(noteId, folder) =>
                  void moveNoteToFolder({ noteId, folder })
                }
                onRenameFolder={(from, to) =>
                  void renameFolder({ treeId: tree._id, from, to })
                }
              />
            </div>
          )}

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
                onAutoArrange={() =>
                  void resetNodePositions({ treeId: resolvedParams.treeId })
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
          initialFolder={noteTarget.note?.folder ?? ""}
          folders={folders}
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
