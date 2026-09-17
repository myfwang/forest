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
- **Nodes could get stuck in `streaming`.** Every write from the streaming loop
  now stamps `generationUpdatedAt` on the node. The conversation view treats a
  `pending`/`streaming` node with no write for 30s as stalled and shows a
  "Retry generation" button that re-runs `ai.generateResponse` on the same
  node.
- **No cancel for an in-flight generation.** `nodes.cancelGeneration` sets
  `cancelRequested`; the streaming loop checks it on every flush, aborts the
  OpenAI stream and stores the partial text with status `cancelled`.
- **Streaming only flushed every 10 chunks.** Partial output is now also flushed
  when 500ms have passed since the last write, so early tokens show up.

## Open

1. **Manual node positions are never reset.** Once dragged, a node keeps its
   saved position even after new siblings shift the layout, causing overlaps.
   Needs an "auto-arrange" action.
2. **Deleting a tree may orphan notes.** Node deletion cleans up notes; verify
   the tree delete path does the same for every node in the tree.
3. **No optimistic UI for branch creation.** The new node only appears after the
   mutation round-trips, which reads as lag on slow connections.
4. **Garden auto-assignment runs only for root nodes** and can create
   near-duplicate garden names ("React", "React Basics") because matching is
   done by the model, not by normalised comparison.
5. **Accessibility:** graph nodes are `div`s with click handlers; no keyboard
   focus or ARIA roles. The notes panel folder controls need labels.
