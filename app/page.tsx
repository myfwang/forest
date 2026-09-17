"use client";

import { TreeSidebar } from "@/components/TreeSidebar";
import { ForestScene, ForestPatch } from "@/components/ForestScene";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

export default function Dashboard() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const forestView = useQuery(api.forestView.getForestView);
  const router = useRouter();

  const patches = useMemo<ForestPatch[]>(() => {
    if (!forestView) return [];
    const result: ForestPatch[] = forestView.forests.map((forest) => ({
      _id: forest._id as Id<"gardens">,
      name: forest.name,
      color: forest.color ?? "#64748b",
      trees: forest.trees,
    }));
    if (forestView.ungroupedTrees.length > 0) {
      result.push({
        _id: null,
        name: "Unsorted",
        color: "#8fbf92",
        trees: forestView.ungroupedTrees,
      });
    }
    return result;
  }, [forestView]);

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

  const isEmpty =
    forestView !== undefined &&
    forestView.forests.every((f) => f.trees.length === 0) &&
    forestView.ungroupedTrees.length === 0;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      <TreeSidebar />

      <div className="flex-1 overflow-y-auto px-10 py-10">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">
            Your forest
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">
            Every conversation is a tree — the bigger the branching, the taller
            it grows. Click a tree to step into it, or a clearing to open that
            forest.
          </p>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-slate-800">
            {forestView === undefined ? (
              <div className="flex h-[70vh] items-center justify-center bg-emerald-50 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                Growing your forest…
              </div>
            ) : isEmpty ? (
              <div className="flex h-[70vh] flex-col items-center justify-center gap-2 bg-emerald-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <p className="text-lg font-medium">Nothing planted yet</p>
                <p className="text-sm">
                  Start a “New conversation” in the sidebar and a tree will
                  sprout here.
                </p>
              </div>
            ) : (
              <ForestScene patches={patches} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
