import { query } from "./_generated/server";
import { requireUserId } from "./lib";

/**
 * One round trip for the 3D forest home view: every forest (garden) with its
 * trees and per-tree node counts, plus ungrouped trees.
 */
export const getForestView = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const [gardens, trees, nodes] = await Promise.all([
      ctx.db
        .query("gardens")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("trees")
        .withIndex("by_user_updated", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
      ctx.db
        .query("nodes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    const nodeCounts = new Map<string, number>();
    for (const node of nodes) {
      nodeCounts.set(node.treeId, (nodeCounts.get(node.treeId) ?? 0) + 1);
    }

    const activeTrees = trees
      .filter((tree) => tree.isArchived !== true)
      .map((tree) => ({
        _id: tree._id,
        title: tree.title,
        gardenId: tree.gardenId,
        nodeCount: nodeCounts.get(tree._id) ?? 0,
        updatedAt: tree.updatedAt,
      }));

    return {
      forests: gardens
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((garden) => ({
          _id: garden._id,
          name: garden.name,
          color: garden.color,
          description: garden.description,
          trees: activeTrees.filter((tree) => tree.gardenId === garden._id),
        })),
      ungroupedTrees: activeTrees.filter((tree) => !tree.gardenId),
    };
  },
});
