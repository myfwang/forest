"use client";

import {
  applyNodeChanges,
  Background,
  Controls,
  Edge,
  Handle,
  Node,
  NodeChange,
  NodeProps,
  Panel,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Id } from "@/convex/_generated/dataModel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { childrenByParent, NodeDoc, rootNodes } from "@/lib/tree";

interface TreeGraphProps {
  nodes: NodeDoc[];
  selectedNodeId: Id<"nodes"> | null;
  onNodeClick: (nodeId: Id<"nodes">) => void;
  currentPath: NodeDoc[];
  noteCounts: Map<string, number>;
  onAddNote?: (nodeId: Id<"nodes">) => void;
  onDeleteNode?: (nodeId: Id<"nodes">) => void;
  onMoveNode?: (nodeId: Id<"nodes">, x: number, y: number) => void;
  onAutoArrange?: () => void;
}

type CustomNodeData = {
  label: string;
  status: NodeDoc["aiResponseStatus"];
  isRevision: boolean;
  noteCount: number;
  selected: boolean;
  onPath: boolean;
  childCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onAddNote?: () => void;
  onDeleteNode?: () => void;
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 104;
const HORIZONTAL_SPACING = 280;
const VERTICAL_SPACING = 170;

const STATUS_LABEL: Record<NodeDoc["aiResponseStatus"], string> = {
  pending: "queued",
  streaming: "writing…",
  complete: "answered",
  error: "failed",
  cancelled: "stopped",
};

function nodeAriaLabel(data: CustomNodeData) {
  const parts = [`Prompt: ${data.label}`, STATUS_LABEL[data.status]];
  if (data.isRevision) parts.push("revision of a sibling");
  if (data.noteCount > 0) {
    parts.push(`${data.noteCount} ${data.noteCount === 1 ? "note" : "notes"}`);
  }
  return parts.join(", ");
}

function CustomNode({ data }: NodeProps) {
  const nodeData = data as CustomNodeData;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (menuOpen) firstItemRef.current?.focus();
  }, [menuOpen]);

  const closeMenu = (restoreFocus: boolean) => {
    setMenuOpen(false);
    if (restoreFocus) menuButtonRef.current?.focus();
  };

  const border = nodeData.selected
    ? "border-emerald-500"
    : nodeData.onPath
      ? "border-emerald-300 dark:border-emerald-700"
      : "border-slate-200 dark:border-slate-700";

  return (
    <div
      className={`relative flex h-[104px] w-[220px] flex-col justify-between overflow-hidden rounded-lg border-2 bg-white p-3 text-[13px] shadow-sm dark:bg-slate-800 ${border}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <div className="flex items-start justify-between gap-2">
        <div
          className="line-clamp-3 min-w-0 flex-1 break-words text-slate-800 dark:text-slate-100"
          aria-hidden="true"
        >
          {nodeData.label}
        </div>
        <div className="relative flex-shrink-0">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && menuOpen) {
                e.stopPropagation();
                closeMenu(true);
              }
            }}
            className="nodrag flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-lg font-bold leading-none text-slate-600 transition-colors hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            aria-label="Prompt options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span aria-hidden="true">⋮</span>
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              />
              <div
                role="menu"
                aria-label="Prompt options"
                className="nodrag absolute right-0 top-8 z-20 min-w-[140px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    closeMenu(true);
                  }
                }}
              >
                <button
                  ref={firstItemRef}
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeMenu(false);
                    nodeData.onAddNote?.();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:bg-slate-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 dark:text-slate-300 dark:hover:bg-slate-700 dark:focus-visible:bg-slate-700"
                >
                  Add note
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeMenu(false);
                    nodeData.onDeleteNode?.();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:bg-red-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 dark:text-red-400 dark:hover:bg-red-900/20 dark:focus-visible:bg-red-900/20"
                >
                  Delete branch
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span aria-hidden="true">{STATUS_LABEL[nodeData.status]}</span>
        {nodeData.isRevision && (
          <span title="Revision of a sibling" aria-hidden="true">
            ✎
          </span>
        )}
        {nodeData.noteCount > 0 && (
          <span aria-hidden="true">🗒 {nodeData.noteCount}</span>
        )}
        {nodeData.childCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onToggleCollapse();
            }}
            className="nodrag ml-auto rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 transition-colors hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            aria-expanded={!nodeData.collapsed}
            aria-label={
              nodeData.collapsed
                ? `Expand ${nodeData.childCount} branches`
                : `Collapse ${nodeData.childCount} branches`
            }
          >
            <span aria-hidden="true">
              {nodeData.collapsed ? "▸" : "▾"} {nodeData.childCount}
            </span>
          </button>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-400"
      />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

/**
 * Drop every descendant of a collapsed node, keeping the collapsed node itself.
 */
function visibleNodes(
  dbNodes: NodeDoc[],
  collapsed: Set<Id<"nodes">>,
): NodeDoc[] {
  if (collapsed.size === 0) return dbNodes;
  const children = childrenByParent(dbNodes);
  const visible = new Set<Id<"nodes">>();

  const visit = (node: NodeDoc) => {
    visible.add(node._id);
    if (collapsed.has(node._id)) return;
    for (const kid of children.get(node._id) ?? []) visit(kid);
  };
  for (const root of rootNodes(dbNodes)) visit(root);

  return dbNodes.filter((node) => visible.has(node._id));
}

/**
 * Lay the forest out top-down, giving every leaf its own column and centring
 * parents over their children.
 */
function layout(
  dbNodes: NodeDoc[],
): Map<Id<"nodes">, { x: number; y: number }> {
  const positions = new Map<Id<"nodes">, { x: number; y: number }>();
  const children = childrenByParent(dbNodes);

  let nextColumn = 0;

  const place = (node: NodeDoc, depth: number): number => {
    const kids = children.get(node._id) ?? [];

    if (kids.length === 0) {
      const column = nextColumn++;
      positions.set(node._id, {
        x: column * HORIZONTAL_SPACING,
        y: depth * VERTICAL_SPACING,
      });
      return column;
    }

    const columns = kids.map((kid) => place(kid, depth + 1));
    const column = (columns[0] + columns[columns.length - 1]) / 2;
    positions.set(node._id, {
      x: column * HORIZONTAL_SPACING,
      y: depth * VERTICAL_SPACING,
    });
    return column;
  };

  for (const root of rootNodes(dbNodes)) {
    place(root, 0);
    nextColumn += 1;
  }

  return positions;
}

export function TreeGraph({
  nodes: dbNodes,
  selectedNodeId,
  onNodeClick,
  currentPath,
  noteCounts,
  onAddNote,
  onDeleteNode,
  onMoveNode,
  onAutoArrange,
}: TreeGraphProps) {
  const [collapsed, setCollapsed] = useState<Set<Id<"nodes">>>(new Set());
  const toggleCollapse = useCallback((nodeId: Id<"nodes">) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const { nodes, edges } = useMemo(() => {
    const shownNodes = visibleNodes(dbNodes, collapsed);
    const positions = layout(shownNodes);
    const pathIds = new Set(currentPath.map((node) => node._id));

    const flowNodes: Node[] = shownNodes.map((node) => {
      const data: CustomNodeData = {
        label:
          node.userPrompt.length > 90
            ? `${node.userPrompt.slice(0, 90)}…`
            : node.userPrompt,
        status: node.aiResponseStatus,
        isRevision: node.revisionOfNodeId !== undefined,
        noteCount: noteCounts.get(node._id) ?? 0,
        selected: node._id === selectedNodeId,
        onPath: pathIds.has(node._id),
        childCount: node.childCount,
        collapsed: collapsed.has(node._id),
        onToggleCollapse: () => toggleCollapse(node._id),
        onAddNote: () => onAddNote?.(node._id),
        onDeleteNode: () => onDeleteNode?.(node._id),
      };
      return {
        id: node._id,
        type: "custom",
        ariaRole: "button",
        ariaLabel: nodeAriaLabel(data),
        domAttributes: { "aria-pressed": data.selected },
        // Declared so React Flow can fit the view before the DOM is measured;
        // without it a freshly added node makes the viewport transform NaN.
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        // Nodes are a fixed size, so report them as already measured: React Flow
        // drops the handle bounds of any node object it sees without `measured`,
        // and edges cannot be drawn until those bounds are measured again.
        measured: { width: NODE_WIDTH, height: NODE_HEIGHT },
        position:
          node.positionX !== undefined && node.positionY !== undefined
            ? { x: node.positionX, y: node.positionY }
            : (positions.get(node._id) ?? { x: 0, y: 0 }),
        data,
      };
    });

    const flowEdges: Edge[] = shownNodes
      .filter((node) => node.parentNodeId)
      .map((node) => {
        const onPath = pathIds.has(node._id) && pathIds.has(node.parentNodeId!);
        return {
          id: `e-${node.parentNodeId}-${node._id}`,
          source: node.parentNodeId!,
          target: node._id,
          animated: onPath && node.aiResponseStatus === "streaming",
          style: {
            stroke: onPath ? "#10b981" : "#cbd5e1",
            strokeWidth: onPath ? 3 : 2,
          },
        };
      });

    return { nodes: flowNodes, edges: flowEdges };
  }, [
    dbNodes,
    collapsed,
    toggleCollapse,
    currentPath,
    selectedNodeId,
    noteCounts,
    onAddNote,
    onDeleteNode,
  ]);

  // React Flow owns node positions while a drag is in flight, so mirror the
  // derived nodes into state and re-seed it whenever the backend data changes.
  const [flowNodes, setFlowNodes] = useState(nodes);
  const [seed, setSeed] = useState(nodes);
  if (seed !== nodes) {
    setSeed(nodes);
    setFlowNodes(nodes);
  }

  // Keyboard users select a node with Enter/Space, which React Flow reports
  // as a `select` change rather than a click.
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setFlowNodes((current) => applyNodeChanges(changes, current));
      for (const change of changes) {
        if (change.type === "select" && change.selected) {
          onNodeClick(change.id as Id<"nodes">);
        }
      }
    },
    [onNodeClick],
  );

  return (
    <div className="h-full w-full" role="region" aria-label="Conversation map">
      <ReactFlow
        nodes={flowNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onNodeClick(node.id as Id<"nodes">)}
        onNodeDragStop={(_, node) =>
          onMoveNode?.(node.id as Id<"nodes">, node.position.x, node.position.y)
        }
        nodesDraggable
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.2, maxZoom: 1.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
      >
        <Background color="#cbd5e1" gap={16} />
        <Controls />
        {onAutoArrange && (
          <Panel position="top-right">
            <button
              type="button"
              onClick={onAutoArrange}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Forget dragged positions and lay the tree out again"
            >
              Auto-arrange
            </button>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
