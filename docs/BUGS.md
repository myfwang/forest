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
- **Accessibility pass (was Open #7).** Graph nodes now expose
  `role="button"`, `aria-pressed` and a descriptive `aria-label`
  (prompt, status, revision flag, note count) via React Flow's `ariaRole` /
  `ariaLabel` / `domAttributes`; Enter/Space selects a node because
  `onNodesChange` forwards `select` changes to `onNodeClick`, so keyboard
  selection follows the same path as clicking. Arrow keys still drag (React
  Flow's built-in behaviour) and `<Handle>` anchors are untouched. The `⋮`
  menu is a labelled `aria-haspopup="menu"` button; the menu is
  `role="menu"`, focuses its first item on open, and Escape closes it and
  returns focus (stopping propagation so React Flow does not also deselect
  the node). A global `.react-flow__node:focus-visible` outline restores the
  ring React Flow's stylesheet removes. `NoteModal` is a `role="dialog"`
  with `aria-modal`, `aria-labelledby`/`aria-describedby`, a Tab/Shift+Tab
  focus trap, dialog-wide Escape/Cmd+Enter handling, and focus restoration to
  the opener on close. `NotesPanel` and `ConversationView` icon-only and
  text-only controls (chevrons, Rename, folder `<select>`, Edit/Delete,
  version arrows, Revise/Retry/Note/Delete) have `aria-label`s, folder
  toggles expose `aria-expanded`/`aria-controls`, and every button has a
  `focus-visible:ring-2 focus-visible:ring-emerald-500` ring. Contrast: the
  worst light-mode offenders — `text-slate-400` small text on white (≈2.9:1)
  and white text on `bg-emerald-600` (≈3.3:1) — were moved to `slate-500`
  and `bg-emerald-700` in the touched components; placeholder colour was
  lifted to `slate-500` in light mode.
- **Manual node positions were never reset.** Once dragged, a node kept its
  saved position even after new siblings shifted the layout, causing overlaps.
  Fixed by an "Auto-arrange" button on the graph (`nodes.resetNodePositions`)
  that clears every saved position in the tree so the computed layout takes
  over. Subtrees can also be collapsed/expanded from a child-count badge
  (client-side only) to keep large trees readable.

## Open

1. **Nodes can get stuck in `streaming`.** If the action dies mid-stream (reload,
   deploy, OpenAI error outside the try block) the node keeps `streaming` forever
   with no retry affordance. Needs a stale-generation timeout and a "retry"
   button on the node.
2. **No cancel for an in-flight generation.** Long answers cannot be stopped.
3. **Streaming writes every 10 chunks and never flushes the tail early**, so the
   last partial chunk only lands with the `complete` write; short answers can
   look frozen.
4. **Deleting a tree may orphan notes.** Node deletion cleans up notes; verify
   the tree delete path does the same for every node in the tree.
5. **No optimistic UI for branch creation.** The new node only appears after the
   mutation round-trips, which reads as lag on slow connections.
6. **Garden auto-assignment runs only for root nodes** and can create
   near-duplicate garden names ("React", "React Basics") because matching is
   done by the model, not by normalised comparison.
7. **Accessibility follow-ups.** The `⋮` menu button lives inside the
   `role="button"` graph node wrapper (nested interactive control) because
   React Flow owns the focusable wrapper; a future pass could move node actions
   into a toolbar outside the node. `NotesPanel` still renames folders through
   `window.prompt`. `TreeSidebar`, `app/signin` and the tree page were not
   audited for contrast or labels in this pass. React Flow's edges are not
   keyboard-reachable (they are non-interactive here).
