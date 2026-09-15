import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireOwnedTree, requireUserId, titleFromPrompt } from "./lib";

/**
 * List all trees (conversations) for the authenticated user.
 */
export const listTrees = query({
  args: {
    limit: v.optional(v.number()),
    archived: v.optional(v.boolean()),
    gardenId: v.optional(v.id("gardens")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const wantArchived = args.archived ?? false;

    const trees = await ctx.db
      .query("trees")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const filtered = trees.filter((tree) => {
      if ((tree.isArchived ?? false) !== wantArchived) return false;
      if (args.gardenId !== undefined && tree.gardenId !== args.gardenId) {
        return false;
      }
      return true;
    });

    return filtered.slice(0, args.limit ?? 50);
  },
});

/**
 * Get a single tree with all its nodes.
 */
export const getTreeWithNodes = query({
  args: { treeId: v.id("trees") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const tree = await ctx.db.get(args.treeId);
    if (!tree || tree.userId !== userId) return null;

    const nodes = await ctx.db
      .query("nodes")
      .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
      .collect();

    const garden = tree.gardenId ? await ctx.db.get(tree.gardenId) : null;

    return { tree, nodes, garden };
  },
});

/**
 * Create a new tree (conversation) with an initial prompt.
 */
export const createTree = mutation({
  args: {
    title: v.optional(v.string()),
    initialPrompt: v.string(),
    model: v.optional(v.string()),
    gardenId: v.optional(v.id("gardens")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const initialPrompt = args.initialPrompt.trim();
    if (initialPrompt.length === 0) throw new Error("Prompt cannot be empty");

    if (args.gardenId) {
      const garden = await ctx.db.get(args.gardenId);
      if (!garden || garden.userId !== userId) {
        throw new Error("Garden not found");
      }
    }

    const now = Date.now();

    const treeId = await ctx.db.insert("trees", {
      userId,
      title: args.title ?? titleFromPrompt(initialPrompt),
      gardenId: args.gardenId,
      gardenIsAutoAssigned: args.gardenId ? false : undefined,
      createdAt: now,
      updatedAt: now,
      isArchived: false,
    });

    const rootNodeId = await ctx.db.insert("nodes", {
      treeId,
      userId,
      parentNodeId: undefined,
      userPrompt: initialPrompt,
      aiResponseStatus: "pending",
      depth: 0,
      childCount: 0,
      createdAt: now,
      model: args.model ?? "gpt-4o-mini",
    });

    await ctx.db.patch(treeId, { rootNodeId });

    return { treeId, rootNodeId };
  },
});

export const updateTreeTitle = mutation({
  args: {
    treeId: v.id("trees"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireOwnedTree(ctx, args.treeId, userId);

    const title = args.title.trim();
    if (title.length === 0) throw new Error("Title cannot be empty");

    await ctx.db.patch(args.treeId, { title, updatedAt: Date.now() });
  },
});

export const setTreeArchived = mutation({
  args: {
    treeId: v.id("trees"),
    isArchived: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireOwnedTree(ctx, args.treeId, userId);

    await ctx.db.patch(args.treeId, { isArchived: args.isArchived });
  },
});

/**
 * Permanently delete a tree along with its nodes and notes.
 */
export const deleteTree = mutation({
  args: { treeId: v.id("trees") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireOwnedTree(ctx, args.treeId, userId);

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
      .collect();
    for (const note of notes) {
      await ctx.db.delete(note._id);
    }

    const nodes = await ctx.db
      .query("nodes")
      .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
      .collect();
    for (const node of nodes) {
      await ctx.db.delete(node._id);
    }

    await ctx.db.delete(args.treeId);
  },
});

/**
 * Context used by topic detection to file a tree into a garden.
 */
export const getTopicContext = internalQuery({
  args: { treeId: v.id("trees") },
  handler: async (ctx, args) => {
    const tree = await ctx.db.get(args.treeId);
    if (!tree) return null;

    const gardens = await ctx.db
      .query("gardens")
      .withIndex("by_user", (q) => q.eq("userId", tree.userId))
      .collect();

    const rootNode = tree.rootNodeId ? await ctx.db.get(tree.rootNodeId) : null;

    return {
      isPinned:
        tree.gardenIsAutoAssigned === false && tree.gardenId !== undefined,
      hasGarden: tree.gardenId !== undefined,
      prompt: rootNode?.userPrompt ?? "",
      response: rootNode?.aiResponse ?? "",
      gardenNames: gardens.map((garden) => garden.name),
    };
  },
});

export const touchTree = internalMutation({
  args: { treeId: v.id("trees") },
  handler: async (ctx, args) => {
    const tree = await ctx.db.get(args.treeId);
    if (!tree) return;
    await ctx.db.patch(args.treeId, { updatedAt: Date.now() });
  },
});
