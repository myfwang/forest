import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Resolve the signed in user, throwing a consistent error when there is none.
 */
export async function requireUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

export async function requireOwnedTree(
  ctx: QueryCtx | MutationCtx,
  treeId: Id<"trees">,
  userId: Id<"users">,
): Promise<Doc<"trees">> {
  const tree = await ctx.db.get(treeId);
  if (!tree || tree.userId !== userId) throw new Error("Tree not found");
  return tree;
}

export async function requireOwnedNode(
  ctx: QueryCtx | MutationCtx,
  nodeId: Id<"nodes">,
  userId: Id<"users">,
): Promise<Doc<"nodes">> {
  const node = await ctx.db.get(nodeId);
  if (!node || node.userId !== userId) throw new Error("Node not found");
  return node;
}

export async function requireOwnedGarden(
  ctx: QueryCtx | MutationCtx,
  gardenId: Id<"gardens">,
  userId: Id<"users">,
): Promise<Doc<"gardens">> {
  const garden = await ctx.db.get(gardenId);
  if (!garden || garden.userId !== userId) throw new Error("Garden not found");
  return garden;
}

/**
 * Derive a short conversation title from the first prompt.
 */
export function titleFromPrompt(prompt: string): string {
  const cleaned = prompt.trim().replace(/\s+/g, " ");
  if (cleaned.length === 0) return "New conversation";
  return cleaned.length > 50 ? `${cleaned.slice(0, 50)}…` : cleaned;
}
