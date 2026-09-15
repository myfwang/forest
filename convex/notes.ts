import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwnedNode, requireOwnedTree, requireUserId } from "./lib";

/**
 * All notes in a tree, newest first.
 */
export const getNotesForTree = query({
  args: { treeId: v.id("trees") },
  handler: async (ctx, { treeId }) => {
    const userId = await requireUserId(ctx);
    await requireOwnedTree(ctx, treeId, userId);

    return await ctx.db
      .query("notes")
      .withIndex("by_tree", (q) => q.eq("treeId", treeId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .collect();
  },
});

export const getNotesForNode = query({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx, { nodeId }) => {
    const userId = await requireUserId(ctx);
    await requireOwnedNode(ctx, nodeId, userId);

    return await ctx.db
      .query("notes")
      .withIndex("by_node", (q) => q.eq("nodeId", nodeId))
      .collect();
  },
});

export const createNote = mutation({
  args: {
    nodeId: v.id("nodes"),
    content: v.string(),
  },
  handler: async (ctx, { nodeId, content }) => {
    const userId = await requireUserId(ctx);
    const node = await requireOwnedNode(ctx, nodeId, userId);

    const trimmed = content.trim();
    if (trimmed.length === 0) throw new Error("Note cannot be empty");

    const now = Date.now();
    const noteId = await ctx.db.insert("notes", {
      userId,
      treeId: node.treeId,
      nodeId,
      content: trimmed,
      createdAt: now,
      updatedAt: now,
    });

    return { noteId };
  },
});

export const updateNote = mutation({
  args: {
    noteId: v.id("notes"),
    content: v.string(),
  },
  handler: async (ctx, { noteId, content }) => {
    const userId = await requireUserId(ctx);

    const note = await ctx.db.get(noteId);
    if (!note || note.userId !== userId) throw new Error("Note not found");

    const trimmed = content.trim();
    if (trimmed.length === 0) throw new Error("Note cannot be empty");

    await ctx.db.patch(noteId, { content: trimmed, updatedAt: Date.now() });

    return { success: true };
  },
});

export const deleteNote = mutation({
  args: { noteId: v.id("notes") },
  handler: async (ctx, { noteId }) => {
    const userId = await requireUserId(ctx);

    const note = await ctx.db.get(noteId);
    if (!note || note.userId !== userId) throw new Error("Note not found");

    await ctx.db.delete(noteId);

    return { success: true };
  },
});
