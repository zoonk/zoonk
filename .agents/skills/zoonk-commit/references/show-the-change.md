# Show the change

A reviewer sees what the change did without running it, from evidence of both sides measured the same way. Capture the before side first, before you edit; a reviewer can't check a before you describe from memory.

| The change                                                                                                    | The PR shows                                                                              |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Makes something faster, lighter or cheaper                                                                    | Each number before → after, with the difference and how it was measured                   |
| Changes what a learner sees: layout, copy, color, a state, a new screen                                       | Screenshots before and after of the screens that show the change, on a phone and a laptop |
| Changes something that moves or takes several steps: a flow, a transition, a wait, a loading state, a gesture | Those screenshots, and a video of each side doing the same steps                          |
| Adds or edits a blog post                                                                                     | A link to the post on the PR's Vercel preview, instead of screenshots                     |

- **Numbers:** each metric with before → after and the difference (`LCP, phone, throttled: 2.4 s → 1.1 s (−54%)`), what was measured (page or command, build, screen, throttling) and how many runs. Measure both sides back to back on the same machine and settings; on a busy machine, compare the numbers noise barely moves (main-thread work, counts, bytes). For pages, `verify:pages --baseline` prints the table ([measuring pages](../../verify/references/pages.md)). Report a number that didn't move or got worse too. "Faster" without numbers isn't evidence.
- **Any visual change gets screenshots:** what decides it is whether a learner would see a difference, not how big the change is. They let a reviewer see what changed from the PR alone, so a PR that changes what a learner sees is not ready to open without them.
- **A new screen** has only an after side and **a removed one** only a before; say so in its panel.
- **A blog post** needs no screenshots: its preview is the page readers will get, on any screen. Once the PR is open, start the preview ([how](../../zoonk-pull-request/references/preview.md)) and link the post on it in the body; after a push that changes the post, preview again and update the link.

## Keep it short and clear

A reviewer looks at every picture, and a long page of them hides the one that matters.

- **Show the few screens that make the change clear,** usually one to three: the screen the change is about, plus another size, scheme or state only where the change looks different there. A change that reaches many screens, such as a redesign, shows a representative few, and the verification section says what else you checked: the [screen coverage](../../verify/references/screen-coverage.md) pictures and reads every screen the branch touches, so the few shown here aren't the only ones read.
- **Each screen gets a collapsed panel,** and its summary says what changed there, so a reviewer can scan the summaries without opening any: `<summary>Today: the time readout sits at the title's end</summary>`. Put the screen that shows the change best first; its panel starts open. `media.md` is laid out this way; lay out hand-made media (the native apps, a sheet of several screens) the same way.
- **Compare each pair before you attach it.** `pr:capture` prints how much of each shot changed and the box around it, and leaves out pairs where nothing changed. When you can't spot the difference at a glance, a reviewer can't either: say in the summary where to look, and when it's a small part of the screen, lead with a shot of just that part (`shot(name, { clip })`, [capturing screens](capture.md)). Drop a pair whose change doesn't show.
