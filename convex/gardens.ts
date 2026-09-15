import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireOwnedGarden, requireOwnedTree, requireUserId } from "./lib";

export const GARDEN_COLORS = [
  "#16a34a",
  "#0ea5e9",
  "#a855f7",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#6366f1",
  "#ec4899",
];

function colorForIndex(index: number): string {
  return GARDEN_COLORS[index % GARDEN_COLORS.length];
}

/**
 * List the user's gardens (topics) with the number of active trees in each.
 */
export const listGardens = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const gardens = await ctx.db
      .query("gardens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const trees = await ctx.db
      .query("trees")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const activeTrees = trees.filter((tree) => tree.isArchived !== true);
    const counts = new Map<string, number>();
    for (const tree of activeTrees) {
      const key = tree.gardenId ?? "ungrouped";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return {
      gardens: gardens
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((garden) => ({
          ...garden,
          treeCount: counts.get(garden._id) ?? 0,
        })),
      ungroupedCount: counts.get("ungrouped") ?? 0,
    };
  },
});

export const getGarden = query({
  args: { gardenId: v.id("gardens") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const garden = await ctx.db.get(args.gardenId);
    if (!garden || garden.userId !== userId) return null;
    return garden;
  },
});

export const createGarden = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const name = args.name.trim();
    if (name.length === 0) throw new Error("Garden name cannot be empty");

    const existing = await ctx.db
      .query("gardens")
      .withIndex("by_user_name", (q) => q.eq("userId", userId).eq("name", name))
      .unique();
    if (existing) return existing._id;

    const gardenCount = (
      await ctx.db
        .query("gardens")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    ).length;

    const now = Date.now();
    return await ctx.db.insert("gardens", {
      userId,
      name,
      description: args.description,
      color: args.color ?? colorForIndex(gardenCount),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateGarden = mutation({
  args: {
    gardenId: v.id("gardens"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireOwnedGarden(ctx, args.gardenId, userId);

    const patch: {
      name?: string;
      description?: string;
      color?: string;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length === 0) throw new Error("Garden name cannot be empty");
      patch.name = name;
    }
    if (args.description !== undefined) patch.description = args.description;
    if (args.color !== undefined) patch.color = args.color;

    await ctx.db.patch(args.gardenId, patch);
  },
});

/**
 * Delete a garden. Trees in it are kept and become ungrouped.
 */
export const deleteGarden = mutation({
  args: { gardenId: v.id("gardens") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireOwnedGarden(ctx, args.gardenId, userId);

    const trees = await ctx.db
      .query("trees")
      .withIndex("by_garden", (q) => q.eq("gardenId", args.gardenId))
      .collect();

    for (const tree of trees) {
      await ctx.db.patch(tree._id, {
        gardenId: undefined,
        gardenIsAutoAssigned: undefined,
      });
    }

    await ctx.db.delete(args.gardenId);
  },
});

/**
 * Move a tree into a garden, or out of every garden when gardenId is omitted.
 * Manual moves pin the tree so topic detection never reassigns it.
 */
export const moveTreeToGarden = mutation({
  args: {
    treeId: v.id("trees"),
    gardenId: v.optional(v.id("gardens")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireOwnedTree(ctx, args.treeId, userId);
    if (args.gardenId) await requireOwnedGarden(ctx, args.gardenId, userId);

    await ctx.db.patch(args.treeId, {
      gardenId: args.gardenId,
      gardenIsAutoAssigned: false,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Used by topic detection: attach a tree to a garden with the given name,
 * creating the garden when it does not exist yet. Trees the user has already
 * filed by hand are left alone.
 */
export const autoAssignGarden = internalMutation({
  args: {
    treeId: v.id("trees"),
    gardenName: v.string(),
  },
  handler: async (ctx, args) => {
    const tree = await ctx.db.get(args.treeId);
    if (!tree) return null;
    if (tree.gardenId && tree.gardenIsAutoAssigned === false) return null;

    const name = args.gardenName.trim();
    if (name.length === 0) return null;

    const gardens = await ctx.db
      .query("gardens")
      .withIndex("by_user", (q) => q.eq("userId", tree.userId))
      .collect();

    const existing = gardens.find(
      (garden) => garden.name.toLowerCase() === name.toLowerCase(),
    );

    const now = Date.now();
    let gardenId: Id<"gardens">;
    if (existing) {
      gardenId = existing._id;
    } else {
      gardenId = await ctx.db.insert("gardens", {
        userId: tree.userId,
        name,
        color: colorForIndex(gardens.length),
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.treeId, {
      gardenId,
      gardenIsAutoAssigned: true,
    });

    return gardenId;
  },
});
