# Activity renderers

An `activity` step's content is `{ template, prompt, fields, check, data? }` from `@zoonk/core/library/activities` (read its README first). Core owns the content schemas, validation, computed answers and grading. The player only draws templates and reports the learner's answer.

## Files

- `activity-step.tsx`: `ActivityStep`, what the player renders for a step of kind `activity`.
- `activity-renderer.ts`: the types below.
- `activity-registry.ts`: `activityRenderers`, one lazily loaded renderer per template. Areas with several renderers can keep their entries in an `activity-registry-<area>.ts` file spread into it (`activity-registry-languages.ts`, `activity-registry-music.ts`), typed with `ActivityRendererMap<ids>` so each `load` is checked against its template, so the registry stays readable.
- `<template-in-kebab-case>/<template-in-kebab-case>-activity.tsx`: one folder per template (`slider-graph/slider-graph-activity.tsx` exports `SliderGraphActivity`), with its helpers and `*.test.ts` for non-trivial pure helpers.
- `_components/`, `_utils/`: building blocks every renderer reuses (see below).

## Which templates exist

Every template in core's catalog has a renderer. `activityRenderers` (`activity-registry.ts`, with the area files `activity-registry-*.ts` spread into it) is typed over `ActivityTemplateId`, so a template added to core doesn't compile until it has a renderer, and the lesson writer can offer the whole catalog.

## ActivityStep

```ts
type ActivityStepProps = {
  content: ActivityStepContent;
  answer: ActivityAnswer | null; // lives in the player reducer
  onAnswerChange: (answer: ActivityAnswer | null) => void;
  phase: "answering" | "checked";
  isCorrect: boolean | null; // the server's grade once checked
};
```

It renders, top to bottom: a badge naming what the learner does, the prompt (an `h2`, whose id labels the canvas), the canvas inside `Suspense` with a skeleton, the data note (the cited source, or "Example numbers, not real data"), and the check area:

- `choice`: the question and the player's option cards under the canvas (number keys pick an option). The canvas is free exploration and never answers. Templates registered with `checkFirst` (predict first, then see) put the options above the canvas instead.
- `numeric`: the question and a number input. The canvas produces the number as the learner moves (`onAnswerChange({ kind: "numeric", value })`) and the input shows it; typing is the keyboard and screen reader alternative. A renderer may leave the number to the input when drawing it would give the answer away (the area model shows its parts, and the learner adds them).
- `interaction`: nothing extra. The canvas end state is the answer: the renderer calls `onAnswerChange` with the template's answer kind (`order`, `assignment`, `selection`, ...) once it's complete, and `null` while it isn't.

Key each `ActivityStep` by its step id, so a renderer's view state (a slider's position) starts fresh on every screen.

After the check (`phase: "checked"`) the options and input are read-only, and `ActivityStep` shows the verdict with the check's explanation, the chosen option's reason (plus the right option and its reason after a wrong pick), or the learner's number next to the correct one. The player's own feedback banner should stay out of the way for this kind (inline feedback), since the step already shows it.

## Renderer props

```ts
type ActivityRendererProps<TId extends ActivityTemplateId> = {
  content: ActivityContentFor<TId>; // narrowed: content.fields is typed
  answer: ActivityAnswer | null;
  onAnswerChange: (answer: ActivityAnswer | null) => void;
  phase: "answering" | "checked";
  expected: ActivityExpected | null; // set once checked
  labelId: string; // the prompt's id, for aria-labelledby
};

type ActivityExpected =
  | { kind: "choice"; optionId: string }
  | { kind: "numeric"; value: number }
  | { kind: "interaction"; answer: ActivityExpectedAnswer }; // core's computeExpected
```

`expected` comes from the same values `checkActivityAnswer` grades with (the correct option, the check's answer that the validator recomputed, or the end state core computes from the fields), never from model-written text. Once checked, the canvas is read-only and draws the expected end state next to the learner's.

A renderer draws the canvas only. It reads `content.check.kind` to know whether it produces the answer, keeps view state (a slider's position) in local state, and keeps the answer controlled through `answer`/`onAnswerChange`.

## Adding a renderer

1. Build `src/activities/<template>/<template>-activity.tsx` exporting a named component typed `(props: ActivityRendererProps<"yourTemplate">) => ReactNode`.
2. Add an entry to `activityRenderers` or its area's `activity-registry-*.ts` file (the registry won't compile without one): `defineActivityRenderer({ badge, load: () => import("./your-template/your-template-activity").then((module) => module.YourTemplateActivity), template })`. Add a badge kind in `_components/activity-badge.tsx` if none fits, and `checkFirst: true` when the learner must predict before the canvas shows anything.
3. Put non-trivial pure helpers (geometry, scales, simulation, grading preview) in the folder with `*.test.ts` tests. No React component tests: a Playwright spec per template plays a lesson that contains it.

## Building blocks

- `ActivityCanvas` (the figure the template draws in, labelled by the prompt), `ActivityTextAlternative` (what the canvas shows, in words, for screen readers; keep it current as the state changes), `ActivityCanvasLabel`, `ActivityReadout` (the big live number).
- `ActivitySlider`: label, live value, range ends; keyboard, snapping to the step and a spoken `valueText` come from `@zoonk/ui/components/slider`.
- `ActivityPlot` with `ActivityPlotGridY`, `ActivityPlotAxisX`, `ActivityPlotLine`, `ActivityPlotArea`, `ActivityPlotGuide`, `ActivityPlotDot`, `ActivityPlotBand`, `ActivityPlotLabel`, and `usePlotScales` for custom marks. It measures its width (`useMeasuredWidth` from `@zoonk/ui/hooks/measured-width`) so text stays 12px everywhere. `sampleFormula` draws a formula with core's safe evaluator; `niceTicks`/`niceDomain` (`@zoonk/utils/plot-scale`) give round axes, shared with the charts lessons and questions show (`@zoonk/learn/visual`).
- `ActivityPlaceHandle` and `usePlacePointer`: something the learner places along an axis, as a slider for keyboards (arrows, Page Up/Down, Home/End) and a drag target with a 44px hit area for pointers, snapping with `snapToStep`.
- `ActivitySortableList`: order items by dragging or with the keyboard, with announcements.
- `ActivitySelectGrid` and `ActivitySelectGridItem`: tap-to-select toggles with result states.
- `useFormatNumber` (`@zoonk/learn/format-number`: locale-aware numbers with the activity's unit, shared with lesson and question charts), `parseLocalizedNumber` from `@zoonk/utils/localized-number` (typed numbers with a decimal comma or point, shared with session questions).
- `ActivityGuessScale` and `ActivityGuessComparison`: a guess placed on a linear or log scale before anything is revealed; once checked, the guess locks and the real value appears on the same scale with the gap shaded, and the comparison says how far off it was ("about 3.5 times too small"). The scale math is in `guess-scale.ts`. `ActivityGuessReveal` puts them together with the text alternative for guess-then-reveal templates; the template adds what explains the value as children.
- `seededRandom`, `hashSeed`, `seededShuffle`, `standardNormal` and `binomialCount` (`@zoonk/utils/seeded-random`): simulations seeded by the lesson, so everyone sees the same first run and "Run again" draws a new seed. `useRevealCount` fills a simulation in over about a second, all at once with reduced motion. `svgPoint` (from `activity-place-handle`) turns a pointer event into SVG coordinates for handles that move in two dimensions.
- `ActivityDragDrop` with `useActivityDraggable` and `useActivityDropTarget`: dragging for pointers and touch on top of a tap path (tap an item, then where it goes) that is also the keyboard path. A finger presses and holds an item to lift it, so a swipe over the items still scrolls (keep `touch-manipulation` on them); a drop goes to the target under the pointer. The drag hook's `isClickAfterDrag()` skips the click a drop leaves behind.
- `ActivityCodeListing` (a colored, numbered program; `toneOf` marks the current or failing line), `ActivityCodeLineInput` and `ActivityCodeEditor` (code the learner edits, colored as they type, 16px on phones so iOS doesn't zoom), `ActivitySnippetBar` with `useInsertSnippet` (buttons that type symbols at the cursor). `highlightCode` colors JavaScript, Python and SQL.
- `_sandbox/`: runs learner code in the browser only, each language in its own Web Worker with network and storage globals removed and a time limit (terminated when it runs out). `runProgram` (JavaScript per run; Python through Pyodide 314.0.7, loaded from jsDelivr when the template appears and kept warm), `runQuery` (SQLite through sql.js 1.14.2, a fresh database per query), `useSandboxRuntime` (starts the download on mount) and `SandboxRunBar`. JavaScript's `console.log` prints like Node on one line.
- `expectedInteraction(expected, kind)`: the expected end state narrowed to the kind a renderer draws. `keyedByPosition`: keys for items that can repeat and never move.
- Sound and music: `useInstrument("piano" | "guitar")` plays sampled instruments (smplr, loaded on first use; samples from its public host) from `SoundEvent`s (`together`, `oneByOne`), and `scheduleClick` draws metronome clicks on the shared audio clock (`activity-audio.ts`). `useActivitySpeech(language)` reads text aloud with generated speech (`useSpokenAudio` from `@zoonk/learn/speech`, never the browser's voice): each speak button shows its own sound loading, playing or failed, one sound at a time; `useSpokenAudio` itself plays sentences in order at any speed with `onSegment`/`onDone`, as the listening activity does. `PianoKeyboard` (one tab stop, arrows move between keys), `GuitarFretboard` (shows a shape, or picks one fret per string as radio groups), `ChordDiagram` and `NoteMark` draw instruments; `music-notes.ts` spells notes and chords (E♭ in C minor, H in German) and `findGuitarVoicing` finds a playable shape. `ActivitySoundButton`, `ActivitySpeakButton`, `useRovingFocus` and `keepArrowKeys` (a control keeps the arrows so the lesson doesn't change screens).
- `_assets/diagrams/`: the checked drawings `labeledDiagram` uses, one file per diagram in core's checked list (`diagrams.ts`), typed so every listed part is drawn. A drawing is path data tagged with a part and a tone, plus where each part's numbered pin sits; `diagram-drawings.test.ts` keeps pins inside the drawing and apart. `DIAGRAM_TONES` mixes each tone into the page background and text color, so drawings follow light and dark. To add a diagram, list it with its parts in core, draw it here and add it to `diagramDrawings`.
- `ActivityFormulaChart`, `ActivityOutputReadouts` (with `useReadoutSentences` for the text alternative) and `ActivityModelSliders`: formula models such as calculators and what-if scenarios. The chart draws one output across one slider's range with a dashed "before" curve and the change between them; the readouts show every output with a comparison note; each slider announces the output it drives. `formula-model.ts` has the starting values, the curves and a y axis that holds every combination of on/off events.
- Money: `useFormatNumber` writes money units ("$", "R$", "€", "USD") in the learner's language's currency format ("$1,000", "US$ 1.000", "1.000 €"), with cents only when a small amount has them (`@zoonk/utils/math-answer`, the same rules as math answers in lessons and sessions).
- `_assets/base-maps/`: the checked base maps `mapExplorer` uses, one generated JSON per map in core's `activityBaseMaps` (`base-maps.ts`), drawn ahead of time by `pnpm --filter @zoonk/player maps:build` (`scripts/base-maps/`) from Natural Earth (public domain, through world-atlas and sane-topojson), the US Census Bureau (us-atlas) and simplified historical outlines. Each drawing records its d3 projection, so `projectPlace` puts a place exactly where the shapes are, and `loadBaseMap` loads one map per chunk. To add a map, list it with its areas in core, add its source to `scripts/base-maps/map-sources.ts` and rebuild.
- Enter on a button inside an activity presses that button; the lesson's "Enter checks" shortcut skips it (`use-lesson-keyboard.ts`). From a slider or the page, Enter still checks.

## Rules

- Accessible: every interaction has a keyboard path, visible focus, labels and spoken values, 44px touch targets, text of at least 12px, and a text alternative. Nothing is drag only.
- Reduced motion: use `motion-safe:` for transitions, so animations become instant changes.
- Colors: semantic tokens only (`viz-accent`, `viz-highlight`, `viz-secondary` and their `-soft` fills for data; `success`, `destructive`, `muted-foreground`, `border` for the rest). They follow light and dark on their own. Pictures with natural colors (diagram tones, atoms in the molecule builder) are the exception, with contrast checked for both themes.
- Formulas run through core's expression evaluator, never `eval`. Computed answers come from core's template hooks (`getActivityTemplate(id).computeValue` / `computeExpected`), so the canvas can't disagree with grading.
- Copy through `useExtracted`, no literals in JSX, no em dashes.
