# Player

The lesson player for Library lessons. Apps render `LessonPlayerProvider` (`@zoonk/player/lesson`) around `LessonPlayerShell` (`@zoonk/player/lesson/shell`) with a Focus or Fun skin (`@zoonk/player/lesson/skins/*`), and load the package's translations with `playerMessages` (`@zoonk/player/messages`). Links, images, the API client and analytics are injected by the app; grading, runs and completion live in `@zoonk/core/lesson-player`.

## Layout

- `src/lesson`: the player itself. One reducer (`lesson-player-reducer.ts`) drives every step kind in both modes; `steps/` renders each kind, `controls/` holds Simpler/Deeper and "Explain first", `feedback/` the verdicts and explanations, `completion/` the completion moment, and `tutor/` hosts the questions sheet.
- `src/activities`: interactive activity renderers, one folder per template (see `src/activities/README.md`).
- `src/components`: the language exercise components (`exercise-step.tsx` plays alphabet, vocabulary, fill-blank, match-columns, multiple choice, reading, listening and translation screens through them) and the scene primitives they share.
- `src/questions`: the tutor: its sheet, streaming, conversation recovery and Markdown, for a lesson in the player and, through `AskTutor` (`@zoonk/player/tutor`), for a chapter, plan or finished mock on their screens. Apps import `@zoonk/player/questions/styles.css` in their stylesheet entry point, and pages that place `AskTutor` send the player's messages. Authorization, allowances, shared answers, persistence and generation stay in Core and the API.

## Styling

Shared scene primitives (`player-read-scene`, `player-choice-scene`, `step-layouts`) own layout, spacing and baseline typography; step components adapt data into them. When a screen needs a variation of a shared pattern, add a semantic variant to the primitive instead of one-off styling. Local styling fits content unique to one feature, such as vocabulary word display or grammar highlighting.
