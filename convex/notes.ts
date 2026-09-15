import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get all notes for a tree
export const getNotesForTree = query({
  args: {
    treeId: v.id("trees"),
  },
  handler: async (ctx, { treeId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_tree", (q) => q.eq("treeId", treeId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .collect();

    return notes;
  },
});

// Create a new note
export const createNote = mutation({
  args: {
    nodeId: v.id("nodes"),
    content: v.string(),
  },
  handler: async (ctx, { nodeId, content }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the node to find the treeId
    const node = await ctx.db.get(nodeId);
    if (!node) {
      throw new Error("Node not found");
    }

    // Verify user owns this node
    if (node.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    const noteId = await ctx.db.insert("notes", {
      userId,
      treeId: node.treeId,
      nodeId,
      content,
      createdAt: now,
      updatedAt: now,
    });

    return { noteId };
  },
});

// Update a note
export const updateNote = mutation({
  args: {
    noteId: v.id("notes"),
    content: v.string(),
  },
  handler: async (ctx, { noteId, content }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const note = await ctx.db.get(noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    // Verify user owns this note
    if (note.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(noteId, {
      content,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Delete a note
export const deleteNote = mutation({
  args: {
    noteId: v.id("notes"),
  },
  handler: async (ctx, { noteId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const note = await ctx.db.get(noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    // Verify user owns this note
    if (note.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(noteId);

    return { success: true };
  },
});
