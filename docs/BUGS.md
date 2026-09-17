# Known bugs / hardening backlog

Status as of the branching + gardens + notes work.

## Fixed

- **Graph edges never rendered.** Custom graph nodes had no React Flow `Handle`,
  so parent→child edges had nothing to anchor to; nodes also had no measured
  dimensions, which made `fitView` blank the map. Fixed by adding top/bottom
  handles, explicit node dimensions, and driving positions through
  `onNodesChange`.
- **`ai.generateResponse` had no ownership check.** The public action resolved
  the node through an internal query that intentionally skips auth, so any
  signed-in user could trigger generation on — and read the answer of — another
  user's node. It now verifies the caller owns the node.

## Open

1. **Nodes can get stuck in `streaming`.** If the action dies mid-stream (reload,
   deploy, OpenAI error outside the try block) the node keeps `streaming` forever
   with no retry affordance. Needs a stale-generation timeout and a "retry"
   button on the node.
2. **No cancel for an in-flight generation.** Long answers cannot be stopped.
3. **Streaming writes every 10 chunks and never flushes the tail early**, so the
   last partial chunk only lands with the `complete` write; short answers can
   look frozen.
4. **Manual node positions are never reset.** Once dragged, a node keeps its
   saved position even after new siblings shift the layout, causing overlaps.
   Needs an "auto-arrange" action.
5. **Deleting a tree may orphan notes.** Node deletion cleans up notes; verify
   the tree delete path does the same for every node in the tree.
6. **No optimistic UI for branch creation.** The new node only appears after the
   mutation round-trips, which reads as lag on slow connections.
7. **Garden auto-assignment runs only for root nodes** and can create
   near-duplicate garden names ("React", "React Basics") because matching is
   done by the model, not by normalised comparison.
8. **Accessibility:** graph nodes are `div`s with click handlers; no keyboard
   focus or ARIA roles. The notes panel folder controls need labels.
