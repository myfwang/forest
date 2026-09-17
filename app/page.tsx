"use client";

import { TreeSidebar } from "@/components/TreeSidebar";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function Dashboard() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const trees = useQuery(api.trees.listTrees, { limit: 12 });
  const gardenData = useQuery(api.gardens.listGardens, {});
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/signin");
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-slate-600 dark:text-slate-400">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const gardens = gardenData?.gardens ?? [];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      <TreeSidebar />

      <div className="flex-1 overflow-y-auto px-10 py-10">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">
            Your forest
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">
            Every conversation is a tree. Go back to any earlier prompt to
            branch off with a clean context, revise a prompt without losing the
            old answer, and let related trees gather into gardens.
          </p>

          <section className="mt-10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Gardens
            </h2>
            {gardens.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No gardens yet. Start a conversation and Forest will sort it
                into one by topic, or create your own from the sidebar.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {gardens.map((garden) => (
                  <Link
                    key={garden._id}
                    href={`/garden/${garden._id}`}
                    className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: garden.color ?? "#64748b" }}
                      />
                      <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                        {garden.name}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {garden.treeCount}{" "}
                      {garden.treeCount === 1 ? "tree" : "trees"}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="mt-10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Recent conversations
            </h2>
            {trees === undefined ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading…
              </p>
            ) : trees.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nothing planted yet — use “New conversation” in the sidebar.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-800">
                {trees.map((tree) => (
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
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
