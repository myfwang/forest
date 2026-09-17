---
name: testing-forest-browser
description: Run Forest browser E2E against an existing Convex deployment, including auth, branching graph, notes folders, and 3D forest scenes.
---

# Forest browser testing

## Devin Secrets Needed
- `CONVEX_DEPLOY_KEY` only for authorized deployment configuration inspection or deployment.
- `OPENAI_API_KEY`, `JWT_PRIVATE_KEY`, and `JWKS` must be configured on the Convex deployment; do not put these in frontend environment files.

## Existing deployment setup
- Set gitignored `.env.local` `NEXT_PUBLIC_CONVEX_URL` to the intended real Convex deployment.
- Read `SITE_URL` with `npx convex env get SITE_URL` using the authorized deployment key.
- Run frontend only with `npx next dev --port <SITE_URL port>`. Avoid `npm run dev` against an already configured deployment: it also launches `convex dev`, which may prompt for login.
- If `.next/dev/lock` is held, identify the owning process and port. Stop only an obsolete frontend belonging to this checkout before restarting.
- `/signin` supports password sign-up. Use a disposable account; no email verification is configured by the Password provider alone.
- Confirm the authenticated empty dashboard before recording.

## High-signal primary flow
- Dashboard `+ New conversation` → initial prompt → `Plant tree`. A moderately long response allows screenshots of partial text with `writing…`, followed by `answered`.
- Click root graph card → composer prompt → `Send`. Capture the very first child and parent connector before any reload. Creating several branches before checking can conceal first-edge regressions.
- Continue from child; conversation `Revise` → `Send as new version`, and `Retry`, create sibling nodes. Verify original replies remain and only selected ancestry is green.
- Conversation `Note` opens modal with content and Folder. Header `Notes` opens folder browser.
- Create notes in two distinct named folders so search exclusion and folder moves have controls. Folder select moves only to existing folders or Unfiled. Rename uses a native browser prompt.
- Click a note after first selecting a different node; verify both graph selection and conversation path change.
- Capture a node while mouse is held during drag, then compare relative offset after reload. Fit view may be needed after layout changes.
- Delete a nonroot with multiple descendants; verify surviving root, note preservation, and removed subtree after reload.

## macOS browser tooling
- If computer text typing loses capitalization or punctuation, use `printf '%s' '<text>' | pbcopy` via shell and native Command+V into the focused field.
- Native dialog/select interactions can require a short render wait before taking a screenshot.
- Browser console/DOM tools may report Chrome unavailable even when the native Chrome window is visible. Screenshots and native clicks remain usable; do not claim DOM timings without collecting them.
- For graph timing, native Chrome DevTools (Command+Option+J) can run a read-only MutationObserver recording `.react-flow__node` and `.react-flow__edge-path` counts with `performance.now()`. Close DevTools before exercising the UI, then display `console.table` of count transitions afterward. This avoids backend calls and does not modify app code.
- Queued states may be shorter than screenshot-tool turnaround. Record continuously, then extract and inspect full frames from the raw recording with ffmpeg using the action timestamps in the recording annotations JSON. Label extracted frames as such; do not infer queued visibility from completed screenshots.

## 3D forest scene checks
- Use conversations with different known node counts to compare tree sizes before hovering; hover itself enlarges a tree. Click the actual canvas mesh to verify navigation rather than substituting a sidebar click.
- Verify labels after mounting, navigation, and reload before any window resize. Accessibility presence alone does not establish visible projected label placement.
- The scene follows OS appearance, not an in-app toggle. On macOS use System Settings → Appearance → Light/Dark. Move the Settings window aside so the canvas remains visible during the change; verify both directions without reloading or navigating between the toggle and assertion.
- Native accessibility may not expose System Settings despite its visible window; screenshots and coordinate clicks remain usable. Exact setting coordinates depend on window position.
- Verify hover and label navigation after a theme change, since changing the palette can rebuild the WebGL scene.
