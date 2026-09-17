import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwnedNode, requireOwnedTree, requireUserId } from "./lib";

const MAX_FOLDER_LENGTH = 60;

function normalizeFolder(folder: string | undefined): string | undefined {
  const trimmed = folder?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_FOLDER_LENGTH);
}

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

/**
 * Folder names used by a tree's notes, alphabetically, with note counts.
 */
export const listFolders = query({
  args: { treeId: v.id("trees") },
  handler: async (ctx, { treeId }) => {
    const userId = await requireUserId(ctx);
    await requireOwnedTree(ctx, treeId, userId);

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_tree", (q) => q.eq("treeId", treeId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    const counts = new Map<string, number>();
    for (const note of notes) {
      if (!note.folder) continue;
      counts.set(note.folder, (counts.get(note.folder) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createNote = mutation({
  args: {
    nodeId: v.id("nodes"),
    content: v.string(),
    folder: v.optional(v.string()),
  },
  handler: async (ctx, { nodeId, content, folder }) => {
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
      folder: normalizeFolder(folder),
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
    folder: v.optional(v.string()),
  },
  handler: async (ctx, { noteId, content, folder }) => {
    const userId = await requireUserId(ctx);

    const note = await ctx.db.get(noteId);
    if (!note || note.userId !== userId) throw new Error("Note not found");

    const trimmed = content.trim();
    if (trimmed.length === 0) throw new Error("Note cannot be empty");

    await ctx.db.patch(noteId, {
      content: trimmed,
      folder: normalizeFolder(folder),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const moveNoteToFolder = mutation({
  args: {
    noteId: v.id("notes"),
    folder: v.optional(v.string()),
  },
  handler: async (ctx, { noteId, folder }) => {
    const userId = await requireUserId(ctx);

    const note = await ctx.db.get(noteId);
    if (!note || note.userId !== userId) throw new Error("Note not found");

    await ctx.db.patch(noteId, {
      folder: normalizeFolder(folder),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const renameFolder = mutation({
  args: {
    treeId: v.id("trees"),
    from: v.string(),
    to: v.string(),
  },
  handler: async (ctx, { treeId, from, to }) => {
    const userId = await requireUserId(ctx);
    await requireOwnedTree(ctx, treeId, userId);

    const target = normalizeFolder(to);
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_tree", (q) => q.eq("treeId", treeId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    const now = Date.now();
    let moved = 0;
    for (const note of notes) {
      if (note.folder !== from) continue;
      await ctx.db.patch(note._id, { folder: target, updatedAt: now });
      moved += 1;
    }

    return { moved };
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
