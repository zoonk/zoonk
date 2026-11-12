Wrap every admin data query in `cacheAdminData` (`src/data/_utils/admin-data-cache.ts`); the layout's guard doesn't cover streamed route segments.

Admin pages are designed too: each answers one question for a staff person and leads with what they came for, as zoonk-design's [Words](../../.agents/skills/zoonk-design/SKILL.md#words) says for internal tools.

## Pages

Staff come for four jobs, and the sidebar (`src/app/(private)/admin-navigation.ts`) is grouped by them: work a queue (Inbox), help a learner (Learners), look at content (Library), check the numbers (Numbers). A page is one of these kinds, built from the shared components in `src/components`; the users pages (`src/app/(private)/users`) are the model.

- **List** (find one): `AdminPage` with a title and no description, `AdminSearch` and filters in an `AdminToolbar`, one `AdminTableColumns` whose first column names the record and opens it. The table owns its empty sentence (`emptyListLabel`).
- **Queue** (what waits): a list that opens on what's waiting, with the action on the row. Its sidebar item shows the count (`queue`, counted in `src/data/inbox/get-inbox.ts`) and Home lists it while it isn't empty.
- **Detail** (what is this, what can I do): `AdminDetailHeader` (name, one line of facts, at most two buttons and a `DetailMenu`), at most one `AdminNotice`, then `AdminTabs`. The first tab shows what staff came for: content as a learner sees it, a person's goals and recent days. Ids, JSON and who wrote it go in a later tab or an `AdminDisclosure`. Tabs are links (`?tab=`), so only the open tab's data loads.
- **Numbers** (is it healthy): one period and one comparison for the page, said once; something that failed is a row on Home and a line at the top of its page.
- **Risky action**: anything that spends money, discards work, signs people out or can't be undone opens `AdminConfirmDialog`. Its title names the object, one sentence says the consequence, the button repeats the verb, and the button that opens it names what it acts on ("Reset skill graph", never "Reset"). A target is picked by name, never typed as an id.

One name per thing, the same in the sidebar, titles, columns and the command palette, and the learner apps' word where there is one (Practice question, Buddy question, Screen). A stored code never reaches the screen: `toWords`, `formatDate` and `formatCount` in `src/lib/format.ts` turn it into words.

A page loads what it shows: when a column or section goes, its query goes too.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
