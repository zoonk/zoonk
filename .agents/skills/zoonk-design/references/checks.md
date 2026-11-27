# Check the experience

Walk through the task: can someone recognize what matters and predict what happens next? Walk one mistake through recovery on a phone: what must the learner reread, repeat or wait for before they can try again? Fix unnecessary interpreting, remembering, and choosing.

Inspect implemented changes in the production build `pnpm start` serves on a phone (390px), a tablet in portrait (820px) and in landscape (1180px), a laptop (1440px), and large desktops (1920px and 2560px), with touch, mouse and keyboard. `pnpm verify:pages` ([verify](../../verify/SKILL.md)) screenshots a page on all six in light and dark and flags overflow, shifts and small targets; look at every screenshot. Check affected loading, empty, disabled, and error states, plus focus, touch targets, long translations, dark mode and more contrast (Playwright's `colorScheme` and `contrast`, or the browser's rendering emulation). Use the product as the people it serves would, end to end, with real content: type a real goal, go through onboarding, study day one. Check every page a change can reach, not only the one you redesigned: a change to a shared piece is looked at on every screen that draws it, and "this screen's files didn't change" doesn't mean it looks right. Before a PR, [the verification step](../../verify/SKILL.md#7-capture-and-review-every-screen-the-branch-touches) pictures every screen the branch touches at the sizes, languages and windows where layouts break, and readers who built none of it give each picture [independent picture review](craft.md#independent-picture-review).

For substantial features, walk the running product as contrasting learner personas, including their bad days, with [zoonk-persona-walkthrough](../../zoonk-persona-walkthrough/SKILL.md). Look for redundant controls, words no earlier screen taught, lines nobody would miss, unnecessary choices, hidden progress, and effort that grows with repeated use.

## The first-glance test

You can't judge your own screen: you know what it means. For every new or changed screen, give an agent that has seen neither the code, the spec nor this conversation one phone-size screenshot, its squint copy (`pnpm design:sketch --squint <picture>`) and [show before you say](show-first.md), and nothing else. It runs [the scan](show-first.md#the-scan) first, then answers:

- What is this screen for?
- What would you tap, and what do you expect to happen?
- Which words or lines don't you understand, or wouldn't miss?
- Which names does it use (a product's, a feature's, a character's, a plan's), and what is each, from this screen alone?

For a [marketing page](marketing-pages.md#the-first-glance-test), the reader and the questions change.

A scan that falls short (V1 to V3), a wrong guess, an unknown word, a name it can only guess at or a "not sure" is a finding. A reader given a screen as text can't run the scan, so that isn't this test. Give it a flow's screens in the order a learner meets them, from the first one they see, so a name counts as known only after the screen that showed it. Don't explain the screen and ask again: change it, by the fix order in [Words](words.md) for an app screen and by the list in [marketing pages](marketing-pages.md) for one of those, or [rethink it](../SKILL.md#rethink-when-stuck). Then use the flow yourself, start to finish, as a learner with a real goal.

## The craft read

The first-glance test asks whether a screen is understood; the craft read asks whether it is drawn right, and you can't judge that on your own screen either. For every new or changed screen, once it works and before the designer's review ([verify](../../verify/SKILL.md)), give an agent that didn't build it the screenshots at 390 and 1440, the same screenshots of the existing screens that do the same thing (the ones the PR names), [craft](craft.md) and [show before you say](show-first.md), and nothing else. It answers [the craft read's questions](craft.md#the-craft-read) for each screenshot and reports each fault as [a finding](craft.md#a-finding): the place, the rule, what is wrong with its numbers, and whether the fault is the screen's or a shared piece's.

Fix every finding in what the change drew that misleads a learner or breaks a named rule, and every one that is [drift](../../../../AGENTS.md#architecture-shared-by-all-workspaces) from a screen that does the same job, file the rest in an issue, and have a reader check only that each fix held and nothing got worse, once. A fault in a shared piece (a bar, a button, a list row, a token's use) is fixed in that piece, so every screen gets it, never with a margin on the one screen. A finding that the design system itself breaks a rule goes to the user once, as a decision about the system. When a finding is one of the system's [deliberate choices](craft.md#deliberate-choices) or an [exception the user granted](craft.md#exceptions-the-user-granted), say so and leave it.

A screen's own readers can't see that it differs from another area's. So when a change draws or moves one of the [roles](../SKILL.md#find-the-piece-before-you-build-one), touches a role's piece, or was built by more than one agent, run [the role read](craft.md#the-role-read).
