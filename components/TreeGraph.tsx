"use client";

import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useState } from "react";

interface TreeGraphProps {
  nodes: Doc<"nodes">[];
  selectedNodeId: Id<"nodes"> | null;
  onNodeClick: (nodeId: Id<"nodes">) => void;
  currentPath: Doc<"nodes">[];
  onAddNote?: (nodeId: Id<"nodes">) => void;
  onDeleteNode?: (nodeId: Id<"nodes">) => void;
}

interface CustomNodeData {
  label: string;
  depth: number;
  branches: number;
  isRoot: boolean;
  background: string;
  color: string;
  border: string;
  onAddNote?: () => void;
  onDeleteNode?: () => void;
}

// Custom node component with 3-dot menu
function CustomNode({ data }: { data: CustomNodeData }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        background: data.background,
        color: data.color,
        border: data.border,
        padding: 12,
        borderRadius: 8,
        width: 220,
        fontSize: 13,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 break-words">{data.label}</div>
        {!data.isRoot && (
          <div className="relative flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="w-6 h-6 flex items-center justify-center rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors font-bold"
              style={{ fontSize: "18px", lineHeight: 1 }}
              title="Node options"
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
                  className="absolute right-0 top-8 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[140px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      data.onAddNote?.();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    Add Note
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      data.onDeleteNode?.();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Delete Node
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
};

export function TreeGraph({
  nodes: dbNodes,
  selectedNodeId,
  onNodeClick,
  currentPath,
  onAddNote,
  onDeleteNode,
}: TreeGraphProps) {
  // Build a map for quick lookups
  const nodeMap = new Map<Id<"nodes">, Doc<"nodes">>();
  dbNodes.forEach((node) => nodeMap.set(node._id, node));

  // Find root node
  const rootNode = dbNodes.find((n) => !n.parentNodeId);

  // Calculate positions using tree layout
  const positions = new Map<Id<"nodes">, { x: number; y: number }>();
  const HORIZONTAL_SPACING = 300;
  const VERTICAL_SPACING = 150;

  if (rootNode) {
    const calculatePositions = (
      nodeId: Id<"nodes">,
      depth: number,
      offset: number
    ): number => {
      const node = nodeMap.get(nodeId);
      if (!node) return offset;

      const children = dbNodes.filter((n) => n.parentNodeId === nodeId);

      if (children.length === 0) {
        positions.set(nodeId, {
          x: offset * HORIZONTAL_SPACING,
          y: depth * VERTICAL_SPACING,
        });
        return offset + 1;
      }

      let currentOffset = offset;
      const childOffsets: number[] = [];

      children.forEach((child) => {
        const childEndOffset = calculatePositions(
          child._id,
          depth + 1,
          currentOffset
        );
        childOffsets.push((currentOffset + childEndOffset - 1) / 2);
        currentOffset = childEndOffset;
      });

      const parentX = (childOffsets[0] + childOffsets[childOffsets.length - 1]) / 2;
      positions.set(nodeId, {
        x: parentX * HORIZONTAL_SPACING,
        y: depth * VERTICAL_SPACING,
      });

      return currentOffset;
    };

    calculatePositions(rootNode._id, 0, 0);
  }

  // Create ReactFlow nodes with custom node type
  const nodes: Node[] = dbNodes.map((node) => {
    const pos = positions.get(node._id) || { x: 0, y: 0 };
    const isSelected = node._id === selectedNodeId;
    const isInPath = currentPath.some((n) => n._id === node._id);
    const isRoot = !node.parentNodeId;

    return {
      id: String(node._id),
      type: "custom",
      position: pos,
      data: {
        label: node.userPrompt.substring(0, 100),
        depth: node.depth,
        branches: node.childCount,
        isRoot,
        background: isSelected ? '#64748b' : isInPath ? '#cbd5e1' : '#f1f5f9',
        color: isSelected ? '#fff' : isInPath ? '#1e293b' : '#475569',
        border: '2px solid ' + (isSelected ? '#475569' : isInPath ? '#94a3b8' : '#cbd5e1'),
        onAddNote: () => onAddNote?.(node._id),
        onDeleteNode: () => onDeleteNode?.(node._id),
      },
    };
  });

  // Create edges
  const edges: Edge[] = dbNodes
    .filter((node) => node.parentNodeId)
    .map((node) => {
      const isInPath =
        currentPath.some((n) => n._id === node._id) &&
        currentPath.some((n) => n._id === node.parentNodeId);

      return {
        id: `e-${node.parentNodeId}-${node._id}`,
        source: String(node.parentNodeId),
        target: String(node._id),
        animated: isInPath,
        style: {
          stroke: '#ef4444',
          strokeWidth: isInPath ? 4 : 3,
        },
      };
    });

  console.log("Graph rendering:", {
    dbNodes: dbNodes.length,
    nodes: nodes.length,
    edges: edges.length,
    sampleNode: nodes[0],
    sampleEdge: edges[0],
  });

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onNodeClick(node.id as Id<"nodes">)}
        nodesDraggable={true}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background color="#cbd5e1" gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
