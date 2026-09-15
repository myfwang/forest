"use client";

import { useAction, useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { useState, useEffect, use } from "react";
import ReactMarkdown from "react-markdown";
import { TreeSidebar } from "@/components/TreeSidebar";
import { TreeGraph } from "@/components/TreeGraph";
import { NoteModal } from "@/components/NoteModal";
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
  const [selectedNodeId, setSelectedNodeId] = useState<Id<"nodes"> | null>(
    null
  );
  const [branchPrompt, setBranchPrompt] = useState("");
  const [isBranching, setIsBranching] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteNodeId, setNoteNodeId] = useState<Id<"nodes"> | null>(null);
  const createBranch = useMutation(api.nodes.createBranch);
  const generateResponse = useAction(api.ai.generateResponse);
  const updateTreeTitle = useMutation(api.trees.updateTreeTitle);
  const createNote = useMutation(api.notes.createNote);
  const deleteNote = useMutation(api.notes.deleteNote);
  const deleteNode = useMutation(api.nodes.deleteNode);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/signin");
    }
  }, [isAuthenticated, isLoading, router]);

  // Auto-select the leaf node (latest in path)
  useEffect(() => {
    if (data?.nodes && data.nodes.length > 0 && !selectedNodeId) {
      const leafNode = data.nodes.find((n) => n.childCount === 0);
      if (leafNode) {
        setSelectedNodeId(leafNode._id);
      }
    }
  }, [data?.nodes, selectedNodeId]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
        <div className="flex-1 flex items-center justify-center">
          <LoadingState />
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  if (!data) {
    return (
      <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
        <TreeSidebar />
        <div className="flex-1 flex items-center justify-center">
          <LoadingState />
        </div>
      </div>
    );
  }

  if (!data.tree) {
    return (
      <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
        <TreeSidebar />
        <div className="flex-1 flex items-center justify-center">
          <ErrorState message="Tree not found" />
        </div>
      </div>
    );
  }

  const { tree, nodes } = data;

  // Build path from root to selected node
  const getPathToNode = (nodeId: Id<"nodes"> | null): Doc<"nodes">[] => {
    if (!nodeId) return [];

    const path: Doc<"nodes">[] = [];
    let currentNode = nodes.find((n) => n._id === nodeId);

    while (currentNode) {
      path.unshift(currentNode);
      currentNode = currentNode.parentNodeId
        ? nodes.find((n) => n._id === currentNode?.parentNodeId)
        : undefined;
    }

    return path;
  };

  const currentPath = getPathToNode(selectedNodeId);
  const selectedNode = nodes.find((n) => n._id === selectedNodeId);

  const handleBranch = async () => {
    if (!branchPrompt.trim() || !selectedNodeId) return;

    setIsBranching(true);
    try {
      const { nodeId } = await createBranch({
        parentNodeId: selectedNodeId,
        userPrompt: branchPrompt,
      });

      // Trigger AI response
      void generateResponse({ nodeId });

      // Select the new node
      setSelectedNodeId(nodeId);
      setBranchPrompt("");
    } catch (error) {
      console.error("Failed to create branch:", error);
    } finally {
      setIsBranching(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!editedTitle.trim() || !tree) return;

    try {
      await updateTreeTitle({
        treeId: tree._id,
        title: editedTitle,
      });
      setIsEditingTitle(false);
    } catch (error) {
      console.error("Failed to update title:", error);
    }
  };

  const handleStartEditTitle = () => {
    if (tree) {
      setEditedTitle(tree.title);
      setIsEditingTitle(true);
    }
  };

  const handleAddNote = (nodeId: Id<"nodes">) => {
    setNoteNodeId(nodeId);
    setNoteModalOpen(true);
  };

  const handleSaveNote = async (content: string) => {
    if (!noteNodeId) return;

    try {
      await createNote({
        nodeId: noteNodeId,
        content,
      });
    } catch (error) {
      console.error("Failed to create note:", error);
    }
  };

  const handleDeleteNode = async (nodeId: Id<"nodes">) => {
    if (!confirm("Are you sure you want to delete this node and all its children?")) {
      return;
    }

    try {
      await deleteNode({ nodeId });
      // If the deleted node was selected, select the parent or root
      if (selectedNodeId === nodeId) {
        const deletedNode = nodes.find((n) => n._id === nodeId);
        if (deletedNode?.parentNodeId) {
          setSelectedNodeId(deletedNode.parentNodeId);
        } else {
          setSelectedNodeId(null);
        }
      }
    } catch (error) {
      console.error("Failed to delete node:", error);
      alert(error instanceof Error ? error.message : "Failed to delete node");
    }
  };

  const handleNoteClick = (nodeId: Id<"nodes">) => {
    setSelectedNodeId(nodeId);
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      {/* Left Sidebar */}
      <TreeSidebar />

      {/* Middle: Conversation or Graph */}
      <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {/* Tree Title */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleSaveTitle();
                  } else if (e.key === "Escape") {
                    setIsEditingTitle(false);
                  }
                }}
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
                autoFocus
              />
              <button
                onClick={() => void handleSaveTitle()}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditingTitle(false)}
                className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex-1 truncate">
                {tree.title}
              </h1>
              <button
                onClick={handleStartEditTitle}
                className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Notes Section */}
        {notes && notes.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-6 py-3">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Notes ({notes.length})
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {notes.map((note) => {
                const node = nodes.find((n) => n._id === note.nodeId);
                return (
                  <button
                    key={note._id}
                    onClick={() => handleNoteClick(note.nodeId)}
                    className="group relative bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 text-sm hover:shadow-md transition-all max-w-xs"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 truncate">
                          {node?.userPrompt.substring(0, 40)}...
                        </p>
                        <p className="text-slate-700 dark:text-slate-300 line-clamp-2">
                          {note.content}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this note?")) {
                            void deleteNote({ noteId: note._id });
                          }
                        }}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 px-6 py-3">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Tree Graph View
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          <div className="w-full h-full">
            <TreeGraph
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onNodeClick={setSelectedNodeId}
              currentPath={currentPath}
              onAddNote={handleAddNote}
              onDeleteNode={handleDeleteNode}
            />
          </div>
        </div>
      </div>

      {/* Right Sidebar: Branch Controls */}
      <div className="w-[500px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">
            Branch Controls
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Click a message to select it, then create a new branch from that point
          </p>
        </div>

        {selectedNode && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                  SELECTED PROMPT
                </p>
                <p className="text-sm text-slate-800 dark:text-slate-200 line-clamp-3">
                  {selectedNode.userPrompt}
                </p>
              </div>

              {selectedNode.aiResponse && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700 max-h-[500px] overflow-y-auto">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                    AI RESPONSE
                  </p>
                  <div className="text-base text-slate-800 dark:text-slate-200 prose prose-base dark:prose-invert max-w-none">
                    <ReactMarkdown>{selectedNode.aiResponse}</ReactMarkdown>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Create a new branch
                </label>
                <textarea
                  value={branchPrompt}
                  onChange={(e) => setBranchPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleBranch();
                    }
                  }}
                  placeholder="Type your prompt here..."
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 resize-none"
                  rows={4}
                  disabled={isBranching}
                />
                <button
                  onClick={() => void handleBranch()}
                  disabled={isBranching || !branchPrompt.trim()}
                  className="w-full bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white text-sm font-medium px-6 py-3 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBranching ? "Creating branch..." : "Create Branch"}
                </button>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Press Enter to submit, Shift+Enter for new line
                </p>
              </div>

              {/* Stats */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    Depth
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedNode.depth}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    Branches
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedNode.childCount}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    Model
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                    {selectedNode.model}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!selectedNode && (
          <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
              Click a node in the graph to select it and create branches
            </p>
          </div>
        )}
      </div>

      {/* Note Modal */}
      <NoteModal
        isOpen={noteModalOpen}
        onClose={() => {
          setNoteModalOpen(false);
          setNoteNodeId(null);
        }}
        onSave={handleSaveNote}
        nodePrompt={
          noteNodeId ? nodes.find((n) => n._id === noteNodeId)?.userPrompt : undefined
        }
      />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 bg-slate-400 rounded-full animate-bounce"></div>
      <div
        className="w-3 h-3 bg-slate-500 rounded-full animate-bounce"
        style={{ animationDelay: "0.1s" }}
      ></div>
      <div
        className="w-3 h-3 bg-slate-600 rounded-full animate-bounce"
        style={{ animationDelay: "0.2s" }}
      ></div>
      <p className="ml-2 text-slate-600 dark:text-slate-400">
        Loading conversation...
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="text-center">
      <p className="text-slate-600 dark:text-slate-400">{message}</p>
    </div>
  );
}
