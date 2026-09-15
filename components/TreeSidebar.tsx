"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, usePathname } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export function TreeSidebar() {
  const trees = useQuery(api.trees.listTrees, { limit: 100 });
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const [showNewTree, setShowNewTree] = useState(false);

  const currentTreeId = pathname?.startsWith("/tree/")
    ? pathname.split("/")[2]
    : null;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen border-r border-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-slate-100">Forest</h1>
          <button
            onClick={() => router.push("/")}
            className="text-slate-400 hover:text-slate-200 transition-colors text-sm"
          >
            Home
          </button>
        </div>
        <button
          onClick={() => setShowNewTree(!showNewTree)}
          className="w-full bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 border border-slate-700 hover:border-slate-600"
        >
          + New Conversation
        </button>
      </div>

      {/* New Tree Form */}
      {showNewTree && (
        <div className="p-4 border-b border-slate-800 bg-slate-800/50">
          <NewTreeForm onClose={() => setShowNewTree(false)} />
        </div>
      )}

      {/* Tree List */}
      <div className="flex-1 overflow-y-auto">
        {trees === undefined ? (
          <div className="p-4 text-sm text-slate-400">Loading...</div>
        ) : trees.length === 0 ? (
          <div className="p-4 text-sm text-slate-400 text-center">
            No conversations yet
          </div>
        ) : (
          <div className="py-2">
            {trees.map((tree) => (
              <button
                key={tree._id}
                onClick={() => router.push(`/tree/${tree._id}`)}
                className={`w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-l-2 ${
                  currentTreeId === tree._id
                    ? "bg-slate-800 border-slate-400 text-slate-100"
                    : "border-transparent text-slate-300 hover:text-slate-100"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium line-clamp-2 flex-1">
                    {tree.title}
                  </p>
                  <span className="text-xs text-slate-500 flex-shrink-0">
                    {formatDate(tree.updatedAt)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={() => void signOut().then(() => router.push("/signin"))}
          className="w-full text-sm text-slate-400 hover:text-slate-200 transition-colors text-left px-2 py-1"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function NewTreeForm({ onClose }: { onClose: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const createTree = useMutation(api.trees.createTree);
  const generateResponse = useAction(api.ai.generateResponse);
  const router = useRouter();

  const handleCreate = async () => {
    if (!prompt.trim()) return;

    setIsCreating(true);
    try {
      const { treeId, rootNodeId } = await createTree({
        initialPrompt: prompt,
      });

      // Trigger AI response generation
      void generateResponse({ nodeId: rootNodeId });

      router.push(`/tree/${treeId}`);
      onClose();
    } catch (error) {
      console.error("Failed to create tree:", error);
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void handleCreate();
          }
          if (e.key === "Escape") {
            onClose();
          }
        }}
        placeholder="What would you like to explore?"
        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        autoFocus
        disabled={isCreating}
      />
      <div className="flex gap-2">
        <button
          onClick={() => void handleCreate()}
          disabled={isCreating || !prompt.trim()}
          className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? "Creating..." : "Create"}
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
