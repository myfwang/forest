import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  MutationCtx,
  query,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireOwnedNode, requireOwnedTree, requireUserId } from "./lib";

/**
 * Get a node with its full path from root (for breadcrumbs and prompting).
 */
export const getNodeWithPath = query({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const node = await ctx.db.get(args.nodeId);
    if (!node || node.userId !== userId) return null;

    const path: Doc<"nodes">[] = [node];
    let currentNode = node;

    while (currentNode.parentNodeId) {
      const parent = await ctx.db.get(currentNode.parentNodeId);
      if (!parent) break;
      path.unshift(parent);
      currentNode = parent;
    }

    return { node, path };
  },
});

/**
 * Path from the tree's root down to a node, without an auth check, so that
 * scheduled generation can read the conversation context it needs.
 */
export const getPathForGeneration = internalQuery({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx, args) => {
    const node = await ctx.db.get(args.nodeId);
    if (!node) return null;

    const path: Doc<"nodes">[] = [node];
    let currentNode = node;

    while (currentNode.parentNodeId) {
      const parent = await ctx.db.get(currentNode.parentNodeId);
      if (!parent) break;
      path.unshift(parent);
      currentNode = parent;
    }

    return { node, path };
  },
});

export const getNodeChildren = query({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    return await ctx.db
      .query("nodes")
      .withIndex("by_parent", (q) => q.eq("parentNodeId", args.nodeId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
  },
});

async function insertSibling(
  ctx: MutationCtx,
  node: Doc<"nodes">,
  userPrompt: string,
  model: string | undefined,
): Promise<Id<"nodes">> {
  const now = Date.now();

  const nodeId = await ctx.db.insert("nodes", {
    treeId: node.treeId,
    userId: node.userId,
    parentNodeId: node.parentNodeId,
    userPrompt,
    aiResponseStatus: "pending",
    depth: node.depth,
    childCount: 0,
    revisionOfNodeId: node._id,
    createdAt: now,
    model: model ?? node.model,
  });

  if (node.parentNodeId) {
    const parent = await ctx.db.get(node.parentNodeId);
    if (parent) {
      await ctx.db.patch(node.parentNodeId, {
        childCount: parent.childCount + 1,
      });
    }
  }

  await ctx.db.patch(node.treeId, { updatedAt: now });

  return nodeId;
}

/**
 * Continue the conversation: add a child prompt under an existing node.
 */
export const createBranch = mutation({
  args: {
    parentNodeId: v.id("nodes"),
    userPrompt: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const parent = await requireOwnedNode(ctx, args.parentNodeId, userId);

    const userPrompt = args.userPrompt.trim();
    if (userPrompt.length === 0) throw new Error("Prompt cannot be empty");

    const now = Date.now();

    const nodeId = await ctx.db.insert("nodes", {
      treeId: parent.treeId,
      userId,
      parentNodeId: args.parentNodeId,
      userPrompt,
      aiResponseStatus: "pending",
      depth: parent.depth + 1,
      childCount: 0,
      createdAt: now,
      model: args.model ?? parent.model,
    });

    await ctx.db.patch(args.parentNodeId, {
      childCount: parent.childCount + 1,
    });
    await ctx.db.patch(parent.treeId, { updatedAt: now });

    return { nodeId, treeId: parent.treeId };
  },
});

/**
 * Rewrite a prompt that has already been sent. The revision becomes a sibling
 * of the original, so the old wording and everything below it stays intact
 * while the new branch starts from the same context.
 */
export const reviseNode = mutation({
  args: {
    nodeId: v.id("nodes"),
    userPrompt: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const node = await requireOwnedNode(ctx, args.nodeId, userId);

    const userPrompt = args.userPrompt.trim();
    if (userPrompt.length === 0) throw new Error("Prompt cannot be empty");

    const nodeId = await insertSibling(ctx, node, userPrompt, args.model);
    return { nodeId, treeId: node.treeId };
  },
});

/**
 * Ask the same question again on a fresh branch.
 */
export const regenerateNode = mutation({
  args: {
    nodeId: v.id("nodes"),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const node = await requireOwnedNode(ctx, args.nodeId, userId);

    const nodeId = await insertSibling(
      ctx,
      node,
      node.userPrompt,
      args.model ?? node.model,
    );
    return { nodeId, treeId: node.treeId };
  },
});

/**
 * Persist a node's position in the graph view.
 */
export const setNodePosition = mutation({
  args: {
    nodeId: v.id("nodes"),
    positionX: v.number(),
    positionY: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireOwnedNode(ctx, args.nodeId, userId);

    await ctx.db.patch(args.nodeId, {
      positionX: args.positionX,
      positionY: args.positionY,
    });
  },
});

/**
 * Forget every manually dragged position in a tree so the graph falls back to
 * the computed layout.
 */
export const resetNodePositions = mutation({
  args: { treeId: v.id("trees") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireOwnedTree(ctx, args.treeId, userId);

    const nodes = await ctx.db
      .query("nodes")
      .withIndex("by_tree", (q) => q.eq("treeId", args.treeId))
      .collect();

    for (const node of nodes) {
      if (node.positionX === undefined && node.positionY === undefined) {
        continue;
      }
      await ctx.db.patch(node._id, {
        positionX: undefined,
        positionY: undefined,
      });
    }
  },
});

/**
 * Update a node's AI response (used while streaming and on completion).
 */
export const updateNodeResponse = internalMutation({
  args: {
    nodeId: v.id("nodes"),
    aiResponse: v.string(),
    status: v.union(
      v.literal("streaming"),
      v.literal("complete"),
      v.literal("error"),
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const node = await ctx.db.get(args.nodeId);
    if (!node) return;

    await ctx.db.patch(args.nodeId, {
      aiResponse: args.aiResponse,
      aiResponseStatus: args.status,
      aiErrorMessage: args.errorMessage,
    });
  },
});

/**
 * Delete a node and all of its descendants.
 */
export const deleteNode = mutation({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx, { nodeId }) => {
    const userId = await requireUserId(ctx);
    const node = await requireOwnedNode(ctx, nodeId, userId);

    if (!node.parentNodeId) {
      const roots = await ctx.db
        .query("nodes")
        .withIndex("by_tree", (q) => q.eq("treeId", node.treeId))
        .collect();
      const otherRoots = roots.filter(
        (candidate) => !candidate.parentNodeId && candidate._id !== nodeId,
      );
      if (otherRoots.length === 0) {
        throw new Error("Cannot delete the only root prompt of a tree");
      }
    }

    const deleteNodeRecursive = async (id: Id<"nodes">) => {
      const children = await ctx.db
        .query("nodes")
        .withIndex("by_parent", (q) => q.eq("parentNodeId", id))
        .collect();

      for (const child of children) {
        await deleteNodeRecursive(child._id);
      }

      const notes = await ctx.db
        .query("notes")
        .withIndex("by_node", (q) => q.eq("nodeId", id))
        .collect();

      for (const note of notes) {
        await ctx.db.delete(note._id);
      }

      await ctx.db.delete(id);
    };

    await deleteNodeRecursive(nodeId);

    if (node.parentNodeId) {
      const parent = await ctx.db.get(node.parentNodeId);
      if (parent) {
        await ctx.db.patch(node.parentNodeId, {
          childCount: Math.max(0, parent.childCount - 1),
        });
      }
    }

    const tree = await ctx.db.get(node.treeId);
    if (tree) {
      const patch: { updatedAt: number; rootNodeId?: Id<"nodes"> } = {
        updatedAt: Date.now(),
      };
      if (tree.rootNodeId === nodeId) {
        const remainingRoots = await ctx.db
          .query("nodes")
          .withIndex("by_tree", (q) => q.eq("treeId", node.treeId))
          .collect();
        const nextRoot = remainingRoots.find((n) => !n.parentNodeId);
        if (nextRoot) patch.rootNodeId = nextRoot._id;
      }
      await ctx.db.patch(node.treeId, patch);
    }

    return { success: true };
  },
});
