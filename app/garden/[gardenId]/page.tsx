"use client";

import { TreeSidebar, NewTreeForm } from "@/components/TreeSidebar";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useEffect, useState, use } from "react";
import Link from "next/link";

export default function GardenPage({
  params,
}: {
  params: Promise<{ gardenId: Id<"gardens"> }>;
}) {
  const { gardenId } = use(params);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  const garden = useQuery(api.gardens.getGarden, { gardenId });
  const trees = useQuery(api.trees.listTrees, { gardenId, limit: 200 });
  const updateGarden = useMutation(api.gardens.updateGarden);
  const deleteGarden = useMutation(api.gardens.deleteGarden);

  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState("");
  const [showNewTree, setShowNewTree] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/signin");
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      <TreeSidebar />

      <div className="flex-1 overflow-y-auto px-10 py-10">
        <div className="mx-auto max-w-3xl">
          {garden === undefined ? (
            <p className="text-slate-500 dark:text-slate-400">Loading…</p>
          ) : garden === null ? (
            <p className="text-slate-500 dark:text-slate-400">
              This garden no longer exists.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: garden.color ?? "#64748b" }}
                />
                {isRenaming ? (
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && name.trim()) {
                        void updateGarden({ gardenId, name }).then(() =>
                          setIsRenaming(false),
                        );
                      }
                      if (e.key === "Escape") setIsRenaming(false);
                    }}
                    autoFocus
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-2xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                ) : (
                  <h1 className="flex-1 text-3xl font-bold text-slate-800 dark:text-slate-200">
                    {garden.name}
                  </h1>
                )}
                <button
                  onClick={() => {
                    setName(garden.name);
                    setIsRenaming(!isRenaming);
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    if (
                      !confirm(
                        "Delete this garden? Its conversations stay, but become unsorted.",
                      )
                    ) {
                      return;
                    }
                    void deleteGarden({ gardenId }).then(() =>
                      router.push("/"),
                    );
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Delete
                </button>
              </div>

              {garden.description && (
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                  {garden.description}
                </p>
              )}

              <button
                onClick={() => setShowNewTree(!showNewTree)}
                className="mt-6 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                + New conversation in this garden
              </button>

              {showNewTree && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800">
                  <NewTreeForm
                    gardenId={gardenId}
                    onClose={() => setShowNewTree(false)}
                  />
                </div>
              )}

              <div className="mt-8 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-800">
                {(trees ?? []).length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                    No trees in this garden yet.
                  </p>
                ) : (
                  (trees ?? []).map((tree) => (
                    <Link
                      key={tree._id}
                      href={`/tree/${tree._id}`}
                      className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <span className="truncate text-sm text-slate-800 dark:text-slate-200">
                        {tree.title}
                      </span>
                      <span className="ml-4 flex-shrink-0 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(tree.updatedAt).toLocaleDateString()}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
