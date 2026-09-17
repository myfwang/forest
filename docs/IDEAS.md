# Forest — product ideas

Forest's edge over a linear chat app is that a conversation is a *map*: you can
explore a branch, abandon it, and come back without polluting context. These
ideas push that into a learning and productivity tool rather than another chat
UI.

## 1. Learning loop

- **Notes → flashcards.** Notes are already anchored to a node. Add a
  "study this folder" mode that turns notes into question/answer cards with a
  spaced-repetition schedule (`dueAt` on the note, SM-2 style intervals).
- **Branch quizzes.** A per-branch action that asks the model to generate 3–5
  questions from the root→node path only, so the quiz matches what you actually
  read, and stores the attempt as a child node.
- **Explain-back node.** A node type where *you* write the answer first and the
  model grades it against the branch context. Retrieval practice beats re-reading.
- **Concept map overlay.** Colour graph nodes by concept tag (auto-extracted like
  gardens are today) so a tree shows topic coverage, not just chronology.
- **Learning goals per garden.** A garden gets a goal ("understand CRDTs") and a
  progress bar driven by notes written, quizzes passed, and branches completed.

## 2. Productivity

- **Command palette** (`⌘K`): jump to tree, node, note or garden; create a branch;
  toggle map/notes. Keyboard-first navigation of the tree (`j/k` siblings,
  `h/l` parent/child).
- **Compare branches side by side.** Pick two sibling branches and diff their
  answers — the core reason to branch at all is to compare approaches.
- **Branch templates / prompt snippets.** Saved prompts ("critique this",
  "explain to a beginner", "find the counterexample") runnable on any node with
  one click; they become the fast path for structured exploration.
- **Summarise subtree.** Collapse a finished branch into a one-paragraph summary
  node that is what gets sent as context, keeping long trees cheap.
- **Export.** Markdown export of a branch (prompt/answer/notes) or of a notes
  folder, so work leaves the app into Obsidian/Notion.
- **Model per branch.** Already stored per node; surface a picker so a branch can
  be re-run on a cheaper or stronger model and compared.

## 3. Structure and recall

- **Notes folders** (shipped): notes are grouped into named folders per tree,
  searchable, with drag-free move between folders and folder rename.
- **Cross-tree note search** from the forest overview, so notes work as a
  knowledge base rather than per-conversation scratch.
- **Backlinks.** `[[note]]`-style links between notes and nodes, rendered in the
  graph as dashed edges.
- **Pin / star branches** to keep the good paths visible when a tree gets large.

## 4. Graph UX

- **Collapse subtrees** with a child count badge; large trees are unreadable today.
- **Minimap + focus mode** — dim everything except the active path.
- **Auto-layout toggle** so manual positions can be reset after a tree grows.
- **Streaming indicator on the edge**, not just the node, so an in-flight branch
  is obvious when zoomed out.

## 5. Platform

- **Shareable read-only tree links** for teaching: a mentor shares the map, not a
  transcript.
- **Import a chat transcript** (ChatGPT/Claude export) as a root path you can
  then branch from.
- **Usage/cost per tree** so exploration has a visible budget.

## Suggested order

1. Command palette + keyboard nav (cheap, compounding).
2. Summarise subtree + collapse subtrees (makes big trees usable).
3. Notes → flashcards + branch quizzes (the learning differentiator).
4. Compare branches side by side.
5. Export and cross-tree search.
