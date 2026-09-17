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
- **Manual node positions were never reset.** Once dragged, a node kept its
  saved position even after new siblings shifted the layout, causing overlaps.
  Fixed by an "Auto-arrange" button on the graph (`nodes.resetNodePositions`)
  that clears every saved position in the tree so the computed layout takes
  over. Subtrees can also be collapsed/expanded from a child-count badge
  (client-side only) to keep large trees readable.
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

1. **Deleting a tree may orphan notes.** Node deletion cleans up notes; verify
   the tree delete path does the same for every node in the tree.
2. **No optimistic UI for branch creation.** The new node only appears after the
   mutation round-trips, which reads as lag on slow connections.
3. **Garden auto-assignment runs only for root nodes** and can create
   near-duplicate garden names ("React", "React Basics") because matching is
   done by the model, not by normalised comparison.
4. **Accessibility:** graph nodes are `div`s with click handlers; no keyboard
   focus or ARIA roles. The notes panel folder controls need labels.
