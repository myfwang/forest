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
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Id } from "@/convex/_generated/dataModel";
import { useCallback, useMemo, useState } from "react";
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
}

type CustomNodeData = {
  label: string;
  status: NodeDoc["aiResponseStatus"];
  isRevision: boolean;
  noteCount: number;
  selected: boolean;
  onPath: boolean;
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
};

function CustomNode({ data }: NodeProps) {
  const nodeData = data as CustomNodeData;
  const [menuOpen, setMenuOpen] = useState(false);

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
        <div className="line-clamp-3 min-w-0 flex-1 break-words text-slate-800 dark:text-slate-100">
          {nodeData.label}
        </div>
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-lg font-bold leading-none text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            title="Prompt options"
          >
            ⋮
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
                className="absolute right-0 top-8 z-20 min-w-[140px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    nodeData.onAddNote?.();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Add note
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    nodeData.onDeleteNode?.();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Delete branch
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span>{STATUS_LABEL[nodeData.status]}</span>
        {nodeData.isRevision && <span title="Revision of a sibling">✎</span>}
        {nodeData.noteCount > 0 && <span>🗒 {nodeData.noteCount}</span>}
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
}: TreeGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const positions = layout(dbNodes);
    const pathIds = new Set(currentPath.map((node) => node._id));

    const flowNodes: Node[] = dbNodes.map((node) => ({
      id: node._id,
      type: "custom",
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
      data: {
        label:
          node.userPrompt.length > 90
            ? `${node.userPrompt.slice(0, 90)}…`
            : node.userPrompt,
        status: node.aiResponseStatus,
        isRevision: node.revisionOfNodeId !== undefined,
        noteCount: noteCounts.get(node._id) ?? 0,
        selected: node._id === selectedNodeId,
        onPath: pathIds.has(node._id),
        onAddNote: () => onAddNote?.(node._id),
        onDeleteNode: () => onDeleteNode?.(node._id),
      } satisfies CustomNodeData,
    }));

    const flowEdges: Edge[] = dbNodes
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

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setFlowNodes((current) => applyNodeChanges(changes, current)),
    [],
  );

  return (
    <div className="h-full w-full">
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
      </ReactFlow>
    </div>
  );
}
