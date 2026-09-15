import { Doc, Id } from "@/convex/_generated/dataModel";

export type NodeDoc = Doc<"nodes">;

export function byId(nodes: NodeDoc[]): Map<Id<"nodes">, NodeDoc> {
  return new Map(nodes.map((node) => [node._id, node]));
}

/**
 * Children of every node, ordered oldest first, keyed by parent id. Root
 * prompts (a tree can have several once the first prompt is revised) are
 * stored under the "root" key.
 */
export function childrenByParent(nodes: NodeDoc[]): Map<string, NodeDoc[]> {
  const map = new Map<string, NodeDoc[]>();
  for (const node of nodes) {
    const key = node.parentNodeId ?? "root";
    const siblings = map.get(key);
    if (siblings) siblings.push(node);
    else map.set(key, [node]);
  }
  for (const siblings of map.values()) {
    siblings.sort((a, b) => a.createdAt - b.createdAt);
  }
  return map;
}

export function rootNodes(nodes: NodeDoc[]): NodeDoc[] {
  return childrenByParent(nodes).get("root") ?? [];
}

/**
 * The chain of prompts from a root down to `nodeId`.
 */
export function pathToNode(
  nodes: NodeDoc[],
  nodeId: Id<"nodes"> | null,
): NodeDoc[] {
  if (!nodeId) return [];
  const lookup = byId(nodes);

  const path: NodeDoc[] = [];
  let current = lookup.get(nodeId);
  const seen = new Set<Id<"nodes">>();

  while (current && !seen.has(current._id)) {
    seen.add(current._id);
    path.unshift(current);
    current = current.parentNodeId
      ? lookup.get(current.parentNodeId)
      : undefined;
  }

  return path;
}

/**
 * Walk from a node down its most recently created children, so selecting a
 * branch point lands on a full conversation instead of a dangling prompt.
 */
export function deepestDescendant(
  nodes: NodeDoc[],
  nodeId: Id<"nodes">,
): NodeDoc | undefined {
  const children = childrenByParent(nodes);
  const lookup = byId(nodes);

  let current = lookup.get(nodeId);
  while (current) {
    const next = children.get(current._id);
    if (!next || next.length === 0) break;
    current = next[next.length - 1];
  }
  return current;
}

export function siblingsOf(nodes: NodeDoc[], node: NodeDoc): NodeDoc[] {
  return childrenByParent(nodes).get(node.parentNodeId ?? "root") ?? [];
}

/**
 * The most recently added prompt, i.e. where the user last left off.
 */
export function latestLeaf(nodes: NodeDoc[]): NodeDoc | undefined {
  if (nodes.length === 0) return undefined;
  return nodes.reduce((latest, node) =>
    node.createdAt > latest.createdAt ? node : latest,
  );
}
