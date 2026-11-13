Wrap every admin data query in `cacheAdminData` (`src/data/_utils/admin-data-cache.ts`); the layout's guard doesn't cover streamed route segments.

Admin pages are designed too: each answers one question for a staff person and leads with what they came for, as zoonk-design's [Words](../../.agents/skills/zoonk-design/SKILL.md#words) says for internal tools.

## Pages

Staff come for four jobs, and the sidebar (`src/app/(private)/admin-navigation.ts`) is grouped by them: work a queue (Inbox), help a learner (Learners), look at content (Library), check the numbers (Numbers). A page is one of these kinds, built from the shared components in `src/components`; the users pages (`src/app/(private)/users`) are the model.

- **List** (find one): `AdminPage` with a title and no description, `AdminSearch` and filters in an `AdminToolbar`, one `AdminTableColumns` whose first column names the record and opens it. The table owns its empty sentence (`emptyListLabel`).
- **Queue** (what waits): a list that opens on what's waiting, with the action on the row. Its sidebar item shows the count (`queue`, counted in `src/data/inbox/get-inbox.ts`) and Home lists it while it isn't empty.
- **Detail** (what is this, what can I do): `AdminDetailHeader` (name, one line of facts, at most two buttons and a `DetailMenu`), at most one `AdminNotice`, then `AdminRecordTabs`. The first tab shows what staff came for: content as a learner sees it, a person's goals and recent days, a record's totals as tiles. Ids, JSON and who wrote it go in a later tab or an `AdminDisclosure`. Tabs are links (`?tab=`), so only the open tab's data loads.
- **Numbers** (is it healthy): one period and one comparison for the page, said once; something that failed is a card on Home and a line at the top of its page.
- **Risky action**: anything that spends money, discards work, signs people out or can't be undone opens `AdminConfirmDialog`. Its title names the object, one sentence says the consequence, the button repeats the verb, and the button that opens it names what it acts on ("Reset skill graph", never "Reset"). A target is picked by name, never typed as an id. A form that only edits (a course's title) opens in the shared `Drawer` instead.
- **A decision** (a content fix): the page's one main action sits in the shared `BottomBar`, passed to `AdminDetailBody` as `bar`.

## Drawing a number, a state or a kind

Pick the form by the question, from the pieces in `src/components`; no page draws its own.

- One value now is a `StatTile`: its icon and name, the number, then how it changed, one line about it or its recent shape (`Sparkline`). A number is never alone: it has a comparison or a detail.
- A value over time is a chart (`AdminBarChart`). A share of a whole is a meter (`MasteryMeter`, the kit's `Meter`). A ranking is a `BarList`, the bar in the row. Records compared field by field are a table. Never a chart for one number or a table for a trend.
- A state is a `StateMark`: one mark and word per meaning, the same on every page (done, going on, waiting, not read, look here, failed, off). A new stored state is added to its list, not colored on the page.
- A kind has one icon everywhere: a page's icon in the sidebar is its icon on Home, in the palette and beside a link to it (`admin-navigation.ts`); a goal's kind is `GoalKindIcon`, a source's `SourceKindIcon`, a person `AdminUserAvatar`.
- Color means one thing: violet is Brain Power, amber is Energy and "look here", blue is progress and good news, pink-red is failed, banned or removed. A change is colored by what it means, not its sign. Charts are drawn in the text color.
- Records that are pictures (Media) are a gallery, not rows.

One name per thing, the same in the sidebar, titles, columns and the command palette, and the learner apps' word where there is one (Practice question, Buddy question, Screen). A stored code never reaches the screen: `toWords`, `formatDate` and `formatCount` in `src/lib/format.ts` turn it into words.

A page loads what it shows: when a column or section goes, its query goes too.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
