import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * List all trees (conversations) for the authenticated user
 */
export const listTrees = query({
  args: {
    limit: v.optional(v.number()),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const trees = await ctx.db
      .query("trees")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .filter((q) => {
        const isArchivedField = q.field("isArchived");
        const targetValue = args.archived ?? false;
        // Match if isArchived equals target, or if isArchived is undefined and target is false
        return q.or(
          q.eq(isArchivedField, targetValue),
          q.and(q.eq(isArchivedField, undefined), q.eq(targetValue, false))
        );
      })
      .order("desc")
      .take(args.limit ?? 50);

    return trees;
  },
});

/**
 * Get a single tree with all its nodes
 */
export const getTreeWithNodes = query({
  args: { treeId: v.id("trees") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const tree = await ctx.db.get(args.treeId);
    if (!tree || tree.userId !== userId) return null;

    // Load all nodes for this tree
    const nodes = await ctx.db
      .query("nodes")
      .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
      .collect();

    return { tree, nodes };
  },
});

/**
 * Create a new tree (conversation) with an initial prompt
 */
export const createTree = mutation({
  args: {
    title: v.optional(v.string()),
    initialPrompt: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const now = Date.now();

    // Generate title from initial prompt if not provided
    const generatedTitle = args.title ??
      (args.initialPrompt.length > 50
        ? args.initialPrompt.substring(0, 50) + "..."
        : args.initialPrompt);

    // Create tree (rootNodeId will be set after creating the root node)
    const treeId = await ctx.db.insert("trees", {
      userId,
      title: generatedTitle,
      createdAt: now,
      updatedAt: now,
      isArchived: false,
    });

    // Create root node
    const rootNodeId = await ctx.db.insert("nodes", {
      treeId,
      userId,
      parentNodeId: undefined,
      userPrompt: args.initialPrompt,
      aiResponseStatus: "pending",
      depth: 0,
      childCount: 0,
      createdAt: now,
      model: args.model ?? "gpt-4o-mini",
    });

    // Update tree with root node reference
    await ctx.db.patch(treeId, { rootNodeId });

    return { treeId, rootNodeId };
  },
});

/**
 * Update tree title
 */
export const updateTreeTitle = mutation({
  args: {
    treeId: v.id("trees"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const tree = await ctx.db.get(args.treeId);
    if (!tree || tree.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.treeId, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Archive a tree (soft delete)
 */
export const archiveTree = mutation({
  args: { treeId: v.id("trees") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const tree = await ctx.db.get(args.treeId);
    if (!tree || tree.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.treeId, { isArchived: true });
  },
});
