---
name: zoonk-design
description: Design, implement, or assess Zoonk interfaces with clear hierarchy, low cognitive effort, and a coherent visual language.
license: MIT
metadata:
  author: zoonk
  version: "4.0.0"
---

# Zoonk design

Build clean, subtle, harmonious interfaces. **Don't make me think:** make the purpose, available actions, and their consequences easy to understand. Reduce the effort of using the interface while preserving the thought that learning requires. The user's explicit requirements take precedence over this skill.

## Understand the task

Start with the person's goal, knowledge, and context. Identify what they need to decide and what the product can handle for them. Choose the structure before the controls; a feature list is not an interface.

Inspect relevant screens and shared components in the current main app and reuse its patterns ([App patterns](references/app-patterns.md)). Mockups are a starting point, not the target: judge a screen by using it, and rethink it when using it shows friction, even if the result looks nothing like the mockup. Question patterns that make the task harder. When the structure is uncertain, prototype with representative content before polishing.

## Shape the experience

- **Resolve unnecessary decisions.** Provide a useful default path. Use known context and reversible defaults; ask people to choose where their preferences or circumstances matter.
- **Give attention a clear order.** Decide what matters now, what supports it, and what can wait. Make the next action obvious; keep alternatives available without giving every option equal emphasis. Reconsider competing elements before fitting them into a tidier layout.
- **Make each element earn its place.** Remove labels that restate the obvious and repeated representations of the same information. Before adding a separate widget, consider whether an existing element can communicate it naturally. Look for simpler combinations of information and action while keeping their meaning clear.
- **Organize complexity around the task.** Sequence decisions when one answer determines what comes next. Keep related information together when people need to compare it. Reveal infrequent detail on demand through discoverable controls. Judge total effort: extra steps and hidden information can create more work.
- **Make behavior predictable.** Use familiar concepts, specific labels, and consistent interactions. Keep needed context visible. If routine use needs lengthy explanation, improve the interaction; place necessary guidance where uncertainty occurs.
- **Build confidence.** Show state and feedback promptly. Prevent likely mistakes, preserve work, and make correction easy. Keep meaningful choices accessible.
- **Design the whole journey.** Preserve context and consistent placement across transitions. Each addition should fit the surrounding experience. Reusing components alone does not make a coherent interface.
- **Express care.** Make people feel capable and comfortable through thoughtful language, balanced proportions, responsive feedback, and smooth continuity. Delight should remain pleasant through repeated use.

For the reasoning behind these principles, see [Design foundations](references/design-foundations.md).

## Zoonk's learning experience

- **One calm experience.** Every learner gets the same interface. Playful mechanics (the buddy, the Trickster, missions, Hyperdrive, belts) live inside it, in the same visual language, and never change what someone learns, earns, or sees as progress.
- **One next step at a time.** Lead with the next action and let everything else wait where people go looking for it. On a wide screen the page's work fills the main area beside the sidebar; supporting status and properties (Today's week and preparation, the Plan's numbers and settings, a subject's coverage) sit in the aside, never a second main column.
- **One main action per screen; structure stays visible.** A screen answers one question and has one main action, in the same place on every page of its kind. Around it, the structure stays in sight: the page's name as its title, each block of content under its own header, lists as one kind of list. Clean comes from that order, not from removing titles and headers. When a result or summary has several things to say, lead with the numbers that matter on its first screen, put the rest in steps after it, and skip the steps with nothing to say.
- **Visible structure.** Show what someone is learning in their own terms (an exam notice's subjects and topics, a course's modules, a language's levels and units), with honest progress, so they can trust the plan covers everything. A long list of items without its structure reads as random.
- **Honest progress.** Show progress as it is, from the person's own work, and never promise a result. Follow the [copy styleguide](../../../packages/i18n/.eloqnt/styleguide.md) for progress wording.
- **Kind motivation.** Rewards come from learning and say upfront how to earn them. Nothing is random or sold, mistakes cost nothing, and nothing creates guilt or streak anxiety.
- **Finished moments.** Short lessons end with a brief completion moment; the full summary waits for the end of the session.
- **Interaction is learning.** An interactive activity is the learning action: the person moves, predicts, or builds something, and a question checks what they saw. Never add one that only decorates.
- **Readable everywhere.** Text meets WCAG AA on every surface it sits on, in light and dark, colored text included (green, red and amber use their `-text` tokens); the faint section labels too (quieter by size and a lighter step, never below 4.5:1), and meaningful marks keep 3:1. `prefers-contrast: more` swaps in strict-contrast values. Theme, contrast and reduced motion follow the device, and every animation has a calm reduced-motion version.

## Zoonk's visual language

The look is **Precision**: a calm, fast study instrument in the spirit of Linear and Vercel. Warm neutrals, hairline edges, Geist for text and Geist Mono for numbers, color wherever it carries meaning (the learner's own pick and place, a kind of activity, an answer's state, progress, a reward) and never as paint, content flat on the page and the day's work in front. Ask of every screen: would Linear ship this?

- **Type.** Geist (`font-sans`) for text; Geist Mono (`font-mono`, tabular) for numbers and dates: minutes, counts, scores, timers, dates, percentages, a row's trailing value, the date line over a title. A value in words ("No date") stays in Geist. Page and task titles use `text-title` (30px, 620, `-0.035em`). Section names use `text-label` (11.5px, uppercase, `--faint`). Body is 14px; rows are a 14px title over a 12px muted line.
- **Flat first.** Content sits on the page. A list is flat rows with a hairline between them (`ListGroup`), as wide as the column; the current or next row is highlighted a little past the column's edges. A panel (`Surface`: `bg-card`, hairline, `rounded-xl`, no shadow) is for one self-contained thing (a preview, a notice, an explainer), used sparingly and never inside another panel. Overlays (the palette, menus, sheets) may cast one soft shadow; nothing else does.
- **Color.** Purposeful, not paint ([color](references/color.md)): color goes where it means something and makes the screen better (a kind, progress, stakes, a reward that lights up once earned, a character), bold when the meaning calls for it, never as a brand-colored button, tinted navigation or a decorative wash; the primary is the text color. Blue (`selected`) is the learner's own and nothing else: a pick before it's judged (a 2px ring and a faint tint) and where they are now (a mark or a ring), never a button, a tab, a link, a hover or a background. A kind of thing in a mixed list (review, practice, challenge, mock, mistakes, conversation, essay; a lesson, the default, is neutral) is its icon in its color (`KindMark`; an 8px `KindDot` where it stands alone), the same everywhere, from one map (`KIND_MARKS`), so its shape tells it apart, never hue alone; a list of one kind marks its rows' state instead; something done is one green check (`DoneMark`); navigation icons stay neutral and there are no tinted icon tiles. Characters keep their faces (the buddy, the Trickster). Brain Power is violet (`brain`, `brain-text`) and nothing else is: every reward amount, the missions' track and reward, the bar to the next level. Green (`success`) is progress made (done, right, studied), red (`destructive`) wrong or removed, amber a suggestion or a flag; fills and marks use the plain token, colored text its `-text` token (`text-success-text`, `text-destructive-text`, `text-warning-text`). Everything else is neutral, and navigation recedes.
- **Progress as data.** Segmented bars (4px, 3px gaps, 2px radius) for steps: the day's blocks on Today, a task's questions (green right, red wrong), a plan's phases. Cells (8px, 3px gaps, 2px radius) for units counted toward a goal: a plan's lessons, a language's CEFR half steps, done in green and outlined in green for what's planned next (today's lessons, the steps to a target level). Rings for the week's daily goals. KPI tiles (`StatTile`: hairline, a colored icon before a quiet label, a mono value) for results. A plan change is a mono diff (`DiffLines`, `PlanEffectDiff`): a red-tinted line for what goes, a green-tinted one for what comes.
- **Shape.** Buttons are 44px for a screen's actions (`size="lg"`) and 30px beside text (`size="sm"`), `rounded-lg`; the primary is inverted, the secondary (`outline`) is see-through with the stronger line. Answer options and KPI tiles are `rounded-option` (12px), panels `rounded-xl` (14px), chips 22px `rounded-md` with the stronger line. Nothing is a pill except avatars, dots and rings. Everything tappable is at least 44px to press (`hit-area` where it looks smaller).
- **Layout.** Every app page lives in one frame (`(app)/layout.tsx`), onboarding and a mock's chooser included, for visitors too, so navigating swaps only the page, never the sidebar or the bars; only the player is full screen. From `lg`: the sidebar (240px), then the page, 40px from it: its title, tabs and content share that one left edge on every page and fill the room, and a wider screen gives the content more room, never a wider margin: grids gain columns, lists, roadmaps and charts grow, the aside holds supporting context, and prose, forms and the buddy's conversation keep their measure on the same edge; onboarding, which asks one thing at a time like a task, centers its column in the page as the player does, its bar on the column's edges ([widths](references/app-patterns.md#one-frame)). From 72rem a page that has supporting context uses `PageWithAside`: the aside runs the screen's full height at its right edge behind a hairline (300px, 320px from 80rem) and scrolls on its own; under 72rem its blocks follow the page. A tablet in portrait is one centered 48rem column with the phone's chrome; a phone has a top bar (goal, level, account, search) and three tabs at the bottom (none under onboarding, until the plan exists). The player's task screens, where the learner does the work (a lesson, a question block, a running mock, a call), are full screen and share one chrome: ✕ and ⋯ in the window's top corners with the title centered over the column, the progress under it, the content top-aligned in the 40rem column (`max-w-column`), everything the screen shows (a question's situation, picture, chart or table; a reading screen's picture) in that column at every size, what helps with it (the buddy, "From the lesson", a passage several questions share) beside it on wide screens, and one action bar pinned at the bottom with a hairline.
- **Keyboard.** Every main action shows its key as a keycap (`ShortcutKbd`: `⏎`, `Esc`, numbers or letters) on devices with a mouse or trackpad; ⌘K/Ctrl+K opens the command palette everywhere, and the search field opens it on phones and tablets.
- **Motion.** Short transitions (150–200 ms) that show what an action did; nothing animates in on its own.
- **Clean is not boring.** Hierarchy comes from size, weight and tone, a big mono number, the buddy or the Trickster where they belong, and color that means something, not from decoration. One suggestion at a time (`Suggestion`); one way to draw each thing.
- Keep company logos out of app interfaces; use that space for the person's task. Logos belong only on marketing pages and the login page.
- Use shared alignment anchors across adjacent sections and columns. Group through spacing, labels and hairlines before adding a container.
- Reuse `@zoonk/ui`, the learn kit (`packages/learn/src/_components`: `Page`, `PageHeader`, `PageSection`, `DetailLayout`, `ListGroup`, `KindDot`, `StatTile`, `NoticeCard`, `Suggestion`, `DiffLines`) and the shell (`packages/learn/src/shell`: `PageWithAside`, `LearnPageBar`, `TaskFrame`). Check existing primitives and the shadcn registry before building a missing web primitive. Use Tailwind utilities and semantic tokens.
- Write concise, concrete copy with enough context to remove uncertainty.
- Build every page from the [page templates](references/app-patterns.md#page-templates) (tab root, detail, catalog, section, browse, task, conversation) and their shared pieces. Keep the same placement for the same things on every page: navigation, search, the main action, page widths and alignment.

## Check the experience

Walk through the task: can someone recognize what matters, predict what happens next, and recover from mistakes? Check what can be removed or combined without losing clarity. Fix unnecessary interpreting, remembering, and choosing.

Inspect implemented changes in the running app on a phone (390px), a tablet in portrait (820px) and in landscape (1180px), a laptop (1440px), and large desktops (1920px and 2560px), with touch, mouse and keyboard. Check affected loading, empty, disabled, and error states, plus focus, touch targets, long translations, and dark mode. Use the product as the people it serves would, end to end, with real content: type a real goal, go through onboarding, study day one. Check every page a change can reach, not only the one you redesigned. Recheck observed friction. For proposals, show representative screens and transitions. State what remains unverified.

For substantial features, walk the running product as contrasting learner personas, including their bad days, with [zoonk-persona-walkthrough](../zoonk-persona-walkthrough/SKILL.md). Look for redundant controls, jargon, unnecessary choices, hidden progress, and effort that grows with repeated use.

## Related guidance

- [Zoonk persona walkthrough](../zoonk-persona-walkthrough/SKILL.md) for using the product as learners before calling a change done.
- [Zoonk compound components](../zoonk-compound-components/SKILL.md) for reusable React UI architecture.
- [Apple Human Interface Guidelines](../apple-human-interface-guidelines/SKILL.md) for Apple UI.
- [Android Material guidelines](../android-material-guidelines/SKILL.md) for Android UI.

Native apps use native controls for performance and platform behavior, with the look of the main app.
