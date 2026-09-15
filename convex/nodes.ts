import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc } from "./_generated/dataModel";

/**
 * Get a node with its full path from root (for breadcrumbs)
 */
export const getNodeWithPath = query({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const node = await ctx.db.get(args.nodeId);
    if (!node || node.userId !== userId) return null;

    // Build path from root to current node
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
 * Get child nodes for a given parent node
 */
export const getNodeChildren = query({
  args: {
    nodeId: v.id("nodes"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const children = await ctx.db
      .query("nodes")
      .withIndex("by_parent", (q) => q.eq("parentNodeId", args.nodeId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    return children;
  },
});

/**
 * Create a new branch (node) from a parent node
 */
export const createBranch = mutation({
  args: {
    parentNodeId: v.id("nodes"),
    userPrompt: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Verify parent ownership
    const parent = await ctx.db.get(args.parentNodeId);
    if (!parent || parent.userId !== userId) {
      throw new Error("Parent node not found");
    }

    const now = Date.now();

    // Create new node
    const nodeId = await ctx.db.insert("nodes", {
      treeId: parent.treeId,
      userId,
      parentNodeId: args.parentNodeId,
      userPrompt: args.userPrompt,
      aiResponseStatus: "pending",
      depth: parent.depth + 1,
      childCount: 0,
      createdAt: now,
      model: args.model ?? parent.model,
    });

    // Update parent's child count
    await ctx.db.patch(args.parentNodeId, {
      childCount: parent.childCount + 1,
    });

    // Update tree's updatedAt
    await ctx.db.patch(parent.treeId, {
      updatedAt: now,
    });

    return { nodeId, treeId: parent.treeId };
  },
});

/**
 * Update a node's AI response (used for streaming and completion)
 */
export const updateNodeResponse = mutation({
  args: {
    nodeId: v.id("nodes"),
    aiResponse: v.string(),
    status: v.union(
      v.literal("streaming"),
      v.literal("complete"),
      v.literal("error")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const node = await ctx.db.get(args.nodeId);
    if (!node || node.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.nodeId, {
      aiResponse: args.aiResponse,
      aiResponseStatus: args.status,
      aiErrorMessage: args.errorMessage,
    });
  },
});

/**
 * Delete a node and all its descendants
 */
export const deleteNode = mutation({
  args: {
    nodeId: v.id("nodes"),
  },
  handler: async (ctx, { nodeId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const node = await ctx.db.get(nodeId);
    if (!node || node.userId !== userId) {
      throw new Error("Node not found or unauthorized");
    }

    // Prevent deleting root node
    if (!node.parentNodeId) {
      throw new Error("Cannot delete the root node");
    }

    // Helper function to recursively delete a node and its descendants
    const deleteNodeRecursive = async (nodeId: Doc<"nodes">["_id"]) => {
      // Get all children first
      const children = await ctx.db
        .query("nodes")
        .withIndex("by_parent", (q) => q.eq("parentNodeId", nodeId))
        .collect();

      // Recursively delete all children
      for (const child of children) {
        await deleteNodeRecursive(child._id);
      }

      // Delete all notes for this node
      const notes = await ctx.db
        .query("notes")
        .withIndex("by_node", (q) => q.eq("nodeId", nodeId))
        .collect();

      for (const note of notes) {
        await ctx.db.delete(note._id);
      }

      // Delete the node itself
      await ctx.db.delete(nodeId);
    };

    // Start recursive deletion
    await deleteNodeRecursive(nodeId);

    // Update parent's child count
    const parent = await ctx.db.get(node.parentNodeId);
    if (parent) {
      await ctx.db.patch(node.parentNodeId, {
        childCount: parent.childCount - 1,
      });
    }

    // Update tree's updatedAt
    await ctx.db.patch(node.treeId, {
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
