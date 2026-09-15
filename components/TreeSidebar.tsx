"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMemo, useState } from "react";
import Link from "next/link";

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TreeSidebar() {
  const trees = useQuery(api.trees.listTrees, { limit: 200 });
  const gardenData = useQuery(api.gardens.listGardens, {});
  const createGarden = useMutation(api.gardens.createGarden);
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuthActions();

  const [showNewTree, setShowNewTree] = useState(false);
  const [newGardenName, setNewGardenName] = useState("");
  const [showNewGarden, setShowNewGarden] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const currentTreeId = pathname?.startsWith("/tree/")
    ? pathname.split("/")[2]
    : null;

  const gardens = gardenData?.gardens ?? [];

  const grouped = useMemo(() => {
    const groups = new Map<string, Doc<"trees">[]>();
    for (const tree of trees ?? []) {
      const key = tree.gardenId ?? "ungrouped";
      const list = groups.get(key);
      if (list) list.push(tree);
      else groups.set(key, [tree]);
    }
    return groups;
  }, [trees]);

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sections: {
    key: string;
    name: string;
    color?: string;
    href?: string;
  }[] = [
    ...gardens.map((garden) => ({
      key: garden._id as string,
      name: garden.name,
      color: garden.color,
      href: `/garden/${garden._id}`,
    })),
    { key: "ungrouped", name: "Unsorted" },
  ];

  return (
    <div className="flex h-screen w-72 flex-col border-r border-slate-800 bg-slate-900 text-slate-100">
      <div className="border-b border-slate-800 p-4">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-slate-100">
            Forest
          </Link>
          <button
            onClick={() => setShowNewGarden(!showNewGarden)}
            className="text-sm text-slate-400 transition-colors hover:text-slate-200"
            title="Create a garden"
          >
            + Garden
          </button>
        </div>
        <button
          onClick={() => setShowNewTree(!showNewTree)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 transition-all duration-200 hover:border-slate-600 hover:bg-slate-700"
        >
          + New conversation
        </button>
      </div>

      {showNewGarden && (
        <div className="border-b border-slate-800 bg-slate-800/50 p-4">
          <input
            value={newGardenName}
            onChange={(e) => setNewGardenName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newGardenName.trim()) {
                void createGarden({ name: newGardenName }).then(() => {
                  setNewGardenName("");
                  setShowNewGarden(false);
                });
              }
              if (e.key === "Escape") setShowNewGarden(false);
            }}
            placeholder="Garden name"
            autoFocus
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      )}

      {showNewTree && (
        <div className="border-b border-slate-800 bg-slate-800/50 p-4">
          <NewTreeForm onClose={() => setShowNewTree(false)} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {trees === undefined ? (
          <div className="p-4 text-sm text-slate-400">Loading…</div>
        ) : trees.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-400">
            No conversations yet
          </div>
        ) : (
          sections.map((section) => {
            const sectionTrees = grouped.get(section.key) ?? [];
            if (sectionTrees.length === 0) return null;
            const isCollapsed = collapsed.has(section.key);

            return (
              <div key={section.key} className="py-1">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    onClick={() => toggle(section.key)}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    {isCollapsed ? "▸" : "▾"}
                  </button>
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ background: section.color ?? "#64748b" }}
                  />
                  {section.href ? (
                    <Link
                      href={section.href}
                      className="flex-1 truncate text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
                    >
                      {section.name}
                    </Link>
                  ) : (
                    <span className="flex-1 truncate text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {section.name}
                    </span>
                  )}
                  <span className="text-xs text-slate-600">
                    {sectionTrees.length}
                  </span>
                </div>

                {!isCollapsed &&
                  sectionTrees.map((tree) => (
                    <TreeRow
                      key={tree._id}
                      tree={tree}
                      gardens={gardens}
                      isActive={currentTreeId === tree._id}
                      onOpen={() => router.push(`/tree/${tree._id}`)}
                    />
                  ))}
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-800 p-4">
        <button
          onClick={() => void signOut().then(() => router.push("/signin"))}
          className="w-full px-2 py-1 text-left text-sm text-slate-400 transition-colors hover:text-slate-200"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function TreeRow({
  tree,
  gardens,
  isActive,
  onOpen,
}: {
  tree: Doc<"trees">;
  gardens: (Doc<"gardens"> & { treeCount: number })[];
  isActive: boolean;
  onOpen: () => void;
}) {
  const moveTreeToGarden = useMutation(api.gardens.moveTreeToGarden);
  const deleteTree = useMutation(api.trees.deleteTree);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  return (
    <div
      className={`group relative border-l-2 ${
        isActive
          ? "border-emerald-500 bg-slate-800 text-slate-100"
          : "border-transparent text-slate-300 hover:bg-slate-800 hover:text-slate-100"
      }`}
    >
      <div className="flex items-start gap-2 px-4 py-2.5">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="line-clamp-2 text-sm font-medium">{tree.title}</p>
          <span className="text-xs text-slate-500">
            {formatDate(tree.updatedAt)}
            {tree.gardenIsAutoAssigned && tree.gardenId ? " · auto-sorted" : ""}
          </span>
        </button>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex-shrink-0 px-1 text-slate-500 opacity-0 transition-opacity hover:text-slate-200 group-hover:opacity-100"
          title="Conversation options"
        >
          ⋮
        </button>
      </div>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-2 top-10 z-20 w-56 rounded-lg border border-slate-700 bg-slate-800 p-2 shadow-xl">
            <p className="px-2 pb-1 text-xs uppercase tracking-wide text-slate-500">
              Move to garden
            </p>
            <select
              value={tree.gardenId ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                void moveTreeToGarden({
                  treeId: tree._id,
                  gardenId: value === "" ? undefined : (value as Id<"gardens">),
                });
                setMenuOpen(false);
              }}
              className="mb-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            >
              <option value="">Unsorted</option>
              {gardens.map((garden) => (
                <option key={garden._id} value={garden._id}>
                  {garden.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!confirm(`Delete "${tree.title}" and all its branches?`)) {
                  return;
                }
                void deleteTree({ treeId: tree._id }).then(() => {
                  setMenuOpen(false);
                  if (isActive) router.push("/");
                });
              }}
              className="w-full rounded px-2 py-1.5 text-left text-sm text-red-400 hover:bg-red-900/20"
            >
              Delete conversation
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function NewTreeForm({
  onClose,
  gardenId,
}: {
  onClose: () => void;
  gardenId?: Id<"gardens">;
}) {
  const [prompt, setPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const createTree = useMutation(api.trees.createTree);
  const generateResponse = useAction(api.ai.generateResponse);
  const router = useRouter();

  const handleCreate = async () => {
    if (!prompt.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const { treeId, rootNodeId } = await createTree({
        initialPrompt: prompt,
        gardenId,
      });

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
          if (e.key === "Escape") onClose();
        }}
        placeholder="What would you like to explore?"
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        autoFocus
        disabled={isCreating}
      />
      <div className="flex gap-2">
        <button
          onClick={() => void handleCreate()}
          disabled={isCreating || !prompt.trim()}
          className="flex-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCreating ? "Planting…" : "Plant tree"}
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-slate-400 transition-colors hover:text-slate-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
