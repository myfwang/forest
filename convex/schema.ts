import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,

  // Trees = Conversations
  trees: defineTable({
    userId: v.id("users"),           // Owner of this tree
    title: v.string(),                // "New Conversation" or custom title
    rootNodeId: v.optional(v.id("nodes")), // Reference to the first prompt (set after creation)
    createdAt: v.number(),            // Timestamp
    updatedAt: v.number(),            // Last activity timestamp
    isArchived: v.optional(v.boolean()), // Soft delete/archive
  })
    .index("by_user", ["userId"])
    .index("by_user_updated", ["userId", "updatedAt"]),

  // Nodes = User prompts + AI responses
  nodes: defineTable({
    treeId: v.id("trees"),            // Which tree this belongs to
    userId: v.id("users"),            // Redundant but useful for queries
    parentNodeId: v.optional(v.id("nodes")), // null = root node

    // Content
    userPrompt: v.string(),           // The user's message
    aiResponse: v.optional(v.string()), // AI's response (null while generating)
    aiResponseStatus: v.union(
      v.literal("pending"),
      v.literal("streaming"),
      v.literal("complete"),
      v.literal("error")
    ),
    aiErrorMessage: v.optional(v.string()),

    // Tree structure
    depth: v.number(),                // 0 = root, helps with visualization
    childCount: v.number(),           // Denormalized for quick checks

    // Metadata
    createdAt: v.number(),
    model: v.string(),                // e.g., "gpt-4o", "gpt-4o-mini"

    // Visualization hints (optional, can be client-only)
    positionX: v.optional(v.number()),
    positionY: v.optional(v.number()),
  })
    .index("by_tree", ["treeId"])
    .index("by_parent", ["parentNodeId"])
    .index("by_tree_created", ["treeId", "createdAt"]),

  // Notes = User annotations on nodes
  notes: defineTable({
    userId: v.id("users"),            // Who created this note
    treeId: v.id("trees"),            // Which tree this belongs to
    nodeId: v.id("nodes"),            // Which node this note is for
    content: v.string(),              // The note text
    createdAt: v.number(),            // When created
    updatedAt: v.number(),            // Last modified
  })
    .index("by_tree", ["treeId"])
    .index("by_node", ["nodeId"])
    .index("by_tree_created", ["treeId", "createdAt"]),
});
