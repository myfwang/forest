# Forest

Forest is a branching AI chat. A conversation is a **tree**: every prompt is a
node, and you can go back to any earlier prompt and continue from there instead
of appending to the end. Only the path from the root to the prompt you selected
is sent to the model, so context you don't want (a tangent, a wrong turn, a long
debugging detour) simply isn't in the request.

- **Branch** — select any prompt in the conversation or in the map and send a
  new prompt from that point.
- **Revise** — rewrite a prompt you already sent. The revision becomes a sibling
  branch; the original wording and everything under it stay intact.
- **Retry** — ask the same question again on a fresh branch to compare answers.
- **Gardens** — topics. A new tree is auto-sorted into a garden from its first
  exchange, and you can move a tree yourself at any time (a manual move is never
  overwritten by the automatic sorting).
- **Notes** — annotate any branch with why it matters.

## Stack

Next.js 16 / React 19 / Tailwind 4 on the frontend, Convex (database, queries,
mutations, actions) with Convex Auth on the backend, `@xyflow/react` for the
tree map, and the OpenAI API for generation.

## Running it

```sh
npm install
npm run dev     # starts `convex dev` and `next dev`; follow the prompts to
                # create/select a Convex deployment on first run
```

Generation needs an OpenAI key **on the Convex deployment** (not in
`.env.local`, since the call happens in a Convex action):

```sh
npx convex env set OPENAI_API_KEY sk-...
```

Without it the app still works, but each prompt comes back with an error
response telling you the key is missing.

## Layout

| Path                          | What's there                                        |
| ----------------------------- | --------------------------------------------------- |
| `convex/schema.ts`            | `gardens`, `trees`, `nodes`, `notes`                |
| `convex/nodes.ts`             | branch / revise / regenerate / delete               |
| `convex/ai.ts`                | root-to-node context building, generation, topics   |
| `convex/gardens.ts`           | garden CRUD, manual moves, automatic topic sorting  |
| `lib/tree.ts`                 | client-side tree traversal helpers                  |
| `components/ConversationView` | the selected path, with revise/retry/notes controls |
| `components/TreeGraph`        | the tree map                                        |
