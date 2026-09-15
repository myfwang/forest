"use client";

import { TreeSidebar } from "@/components/TreeSidebar";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Dashboard() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const trees = useQuery(api.trees.listTrees, { limit: 1 });
  const router = useRouter();

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/signin");
    }
  }, [isAuthenticated, isLoading, router]);

  // Auto-navigate to the most recent tree if one exists
  useEffect(() => {
    if (trees && trees.length > 0) {
      router.push(`/tree/${trees[0]._id}`);
    }
  }, [trees, router]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-slate-600 dark:text-slate-400">Loading...</div>
      </div>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      <TreeSidebar />

      {/* Welcome Screen */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-200 mb-4">
            Welcome to Forest
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
            Create branching AI conversations. Each prompt creates a new path through your forest of ideas.
          </p>
          <div className="space-y-4 text-sm text-slate-500 dark:text-slate-500 text-left bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
            <div className="flex gap-3">
              <span className="text-2xl">🌱</span>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Plant a tree
                </p>
                <p>Click "New Conversation" to start exploring</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl">🌿</span>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Create branches
                </p>
                <p>Click any message to branch off with a new idea</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl">🌲</span>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Grow your forest
                </p>
                <p>Navigate through different conversation paths</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
