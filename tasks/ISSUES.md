# Activity Player - Issue Breakdown

This is our issues breakdown for implementing [this plan](./PLAN.md).

## Dependency Graph

```
Phase 0: Issue 1 (contracts+shuffle) ─── Issue 2 (utilities)
                │
Phase 1: Issue 3 (data+fixtures) ─── Issue 4 (prepare data)
                │
Phase 2: Issue 5 (reducer) ──────┐
         Issue 6 (header+bar) ───┤
         Issue 7 (feedback) ─────┤
         Issue 8 (completion) ───┤
         Issue 9 (orchestrator) ◄┘ all Phase 2
                │
Phase 3: Issues 10-14 (steps) ◄──── parallelizable after Issue 9
Phase 4a: Issue 15 (visual registry) ◄── after Issue 1
Phase 4b: Issues 16-22 (visual kinds) ◄── parallelizable after Issue 15
Phase 5: Issues 23-24 (language) ◄── Issues 3, 4, 12
Phase 6: Issue 25 (server action) ◄── Issue 9
         Issue 26 (challenge) ◄── Issues 9, 11
         Issue 27 (e2e comprehensive) ◄── everything
```

## Phase 0: Contracts & Utilities

### Issue 1: Visual content contract + serialized activity types + shuffle utility

Create `parseVisualContent()` in `@zoonk/core` following the same pattern as `parseStepContent()` in `content-contract.ts`. Zod schemas for 7 visual kinds (code, image, table, chart, diagram, timeline, quote — no audio/video). Reference the AI tool schemas in `packages/ai/src/tasks/steps/_tools/*.ts` but omit `stepIndex`. Note: `challengeActivityContentSchema` was eliminated — intro/reflection are now stored as static steps (first/last) in the challenge activity, so no `Activity.content` parsing is needed.

Define serialized types (`SerializedStep`, `SerializedWord`, `SerializedSentence`, `SerializedActivity`) for passing parsed data from server to client — include word/sentence enrichment fields for language steps. These types represent the post-parsing, BigInt-serialized shape that the `<ActivityPlayer>` client component receives as props.

Add Fisher-Yates `shuffle()` to `@zoonk/utils`. Unit tests for all schemas and shuffle.

### Issue 2: Player utilities (answer validation, score computation)

Create pure `checkAnswer()` functions for each interactive step kind (multipleChoice, fillBlank, matchColumns, sortOrder, selectImage, vocabulary, arrangeWords). Used both client-side (immediate feedback) and server-side (re-validation in the completion action).

Also create `computeScore()` for BP/energy calculation: BP always +10 per activity completion (never down, no first-completion distinction). Energy +0.2 per correct answer, -0.1 per incorrect answer. Energy clamping [0, 100] done by consumer.

## Phase 1: Data Layer

### Issue 3: Extend `getActivity()` + language data functions + test fixtures

The current `getActivity()` in `apps/main/src/data/activities/get-activity.ts` is missing fields needed by the player. Add: `word{}` relation (include word fields like `word`, `translation`, `romanization`, `audioUrl`), `sentence{}` relation (include `sentence`, `translation`, `romanization`, `audioUrl`), activity-level `language`, `organizationId`. Note: `Activity.content` field was removed in the challenge refactor — intro/reflection are now static steps.

Also create `getLessonWords(lessonId)` and `getLessonSentences(lessonId)` for distractor pools — these return all words/sentences for a lesson so the client can pick random distractors. See Word/Sentence models in `vocabulary.prisma`.

Add test fixtures to `@zoonk/testing`. Integration tests for all new queries.

**Depends on**: nothing
**Key files**: `apps/main/src/data/activities/get-activity.ts`, `packages/db/src/prisma/vocabulary.prisma`, `packages/testing/src/`

### Issue 4: Server-side data preparation function

Create `prepareActivityData()` that takes raw activity data from `getActivity()` and produces a `SerializedActivity` for client props. Responsibilities:

- Parse step content via `parseStepContent()` (from `content-contract.ts`)
- Parse visual content via `parseVisualContent()` (from Issue 1)
- Enrich language steps with word/sentence data from the relations added in Issue 3
- Include lesson word/sentence pools for distractors
- Serialize BigInts to strings (client components can't receive BigInt)

This function runs on the server inside the `"use cache"` page. Integration tests.

**Depends on**: Issues 1, 3
**Key files**: `packages/core/src/steps/content-contract.ts`, `apps/main/src/data/activities/get-activity.ts`

## Phase 2: Player Shell

### Issue 5: Player state reducer

Create a `useReducer`-based state machine for the activity player. Phases: `playing` → `feedback` → `playing` → ... → `completed`. Actions: `SELECT_ANSWER`, `CHECK_ANSWER`, `CONTINUE`, `COMPLETE`, `NAVIGATE_STEP` (for static steps).

The reducer is a pure function — no side effects. State includes: current step index, phase, selected answers per step, results per step, challenge dimension inventory.

### Issue 6: Player header + progress bar + action bar + skeleton

Build the always-visible player shell components using compound component patterns:

- `PlayerHeader`: close link (left, `X` icon), step fraction (right, `tabular-nums` for stable layout)
- `PlayerProgressBar`: 2px full-bleed bar reusing `Progress`/`ProgressTrack`/`ProgressIndicator` from `@zoonk/ui` with `h-0.5` override
- `PlayerActionBar`: full-width Check/Continue button, sticky bottom with safe-area padding, disabled state (50% opacity until answer selected)
- `ActivityPlayerSkeleton`: Suspense fallback matching the player layout

Keyboard support: Enter to check/continue, arrow keys for static step navigation.

**Depends on**: nothing (UI-only, can start early)
**Key files**: `packages/ui/src/components/progress.tsx`, `@zoonk/ui` components

### Issue 7: Feedback screen component

When user checks an answer, step content area crossfades (200ms CSS transition) to a full-screen feedback view:

- Correct/incorrect indicator
- Subtle 5% opacity green/red background wash (300ms fade)
- Feedback message text (can be long, scrollable)
- Continue button in `PlayerActionBar` (same position as Check for muscle memory)
- Challenge variant: shows consequence text + dimension effects

Use CSS transitions only (no JS animation libraries) for excellent FPS.

**Depends on**: Issue 6 (uses PlayerActionBar)
**Key files**: none (new component)

### Issue 8: Completion screen component

Final screen after all steps:

1. Score — large, dominant (e.g., "4/5 correct")
2. BP earned — single line with `BeltIndicator` dot (reuse `calculateBeltLevel()` from `packages/utils/src/belt-level.ts`). Level-up celebration if applicable.
3. "Next Activity" — full-width `default` button
4. "Done" — `outline` variant, returns to lesson
5. Activity feedback — extend existing `ContentFeedback` (see `apps/main/src/app/[locale]/(catalog)/learn/[prompt]/content-feedback.tsx`) with a `variant="minimal"` (smaller icons, single row, no heading)

Uses `useAuthState()` from `@zoonk/auth` for client-side session. Guests see score + sign-up CTA instead of BP/feedback. Session resolves during gameplay so no flash — small skeleton for the near-impossible edge case.

### Issue 9: ActivityPlayer orchestrator + page wiring

Wire everything together. `ActivityPlayer` client component that:

- Uses the reducer from Issue 5
- Dispatches to step renderers via a registry (placeholder renderers initially — just show step kind + content summary)
- Two layout modes: `StaticStepLayout` (visual top, text bottom, tap/swipe/arrow navigation) and `InteractiveStepLayout` (single scroll area with check button)

## Phase 3: Step Renderers (parallelizable after Issue 9)

### Issue 10: Static step renderer

Three variants: `text`, `grammarExample`, `grammarRule` (see `staticContentSchema` in `content-contract.ts`).

`StaticStepLayout`:

- Visual on top (fills remaining space, vertically scrollable if tall, centered when it fits). Add a just a placeholder for visuals since we'll work on them in Phase 4. On larger screens maybe we can split this to show the visual on the left and the content on the right? Thoughts? Maybe check with the `design-architect` agent to see what's the best design for this entire page. Focus on the static step render only since other step kinds may need a different layout structure. Inspiration: Apple Tips iOS app that Apple uses to teach how to use their products.
- Text panel fixed at bottom (natural height)
- No Continue/check button — navigation by input method:
  - Touch: invisible tap zones (left 1/3 = prev, right 2/3 = next) + swipe left/right
  - Keyboard: arrow keys
  - Mouse: hover-reveal edge chevrons (`pointer-coarse:hidden`), match `HorizontalScroll` button style
- First-time coaching overlay ("Swipe, tap edges, or use arrow keys"), fades after 1.5s, stored in `localStorage`
- Double-check all design decisions with `design-architect` agent for a great UX aligned with our design philosophy.
- Add e2e tests covering all expected user interactions and behaviors. Try to think of edge cases to ensure a robust implementation and test coverage.

**Key files**: `packages/core/src/steps/content-contract.ts` (staticContentSchema)

### Issue 11: Multiple choice step (all variants)

Three variants: `core`, `language`, `challenge` (see `multipleChoiceContentSchema` in `content-contract.ts`).

- Core: question + optional context + tappable options
- Language: context with romanization/translation, options with romanization
- Challenge: narrative context, consequence shown in feedback via dimension effects
- Use the `design-architect` agent to ensure the UI/UX for these steps is engaging and intuitive, especially considering the different variants and their unique requirements. Make sure the UI is also consistent with static steps while being optimized for interaction.
- Each variant may have different requirements, use the `design-architect` agent to determine the best design for each while maintaining a cohesive overall experience.

Shared selection mechanics with the reducer's `SELECT_ANSWER` action. Single-select only. Selected option visually highlighted.

- Add e2e tests covering all expected user interactions and behaviors. Try to think of edge cases to ensure a robust implementation and test coverage.

**Key files**: `packages/core/src/steps/content-contract.ts` (multipleChoiceContentSchema)

### Issue 12: Fill blank step + WordBank component

Reusable `WordBank` compound component:

- Shuffled word tiles
- Tap-to-select only (no drag-and-drop)
- Selected tiles fade to 50% opacity in bank
- Min 44px touch targets
- Tapping a placed tile returns it to the bank
- Double-check best design for this with the `design-architect` agent.

`FillBlankStep`: template text with `[BLANK]` placeholders, uses WordBank below. Answer is the ordered sequence of selected words. Checks answer order via `checkAnswer()` from Issue 2.

See `fillBlankContentSchema` in `content-contract.ts`. E2E test.

**Key files**: `packages/core/src/steps/content-contract.ts` (fillBlankContentSchema)

### Issue 13: Match columns + sort order steps

**Match columns**: two columns, tap left item then tap right item to connect. Subtle connecting lines for matched pairs. Deselect by tapping a matched pair again. See `matchColumnsContentSchema`.

**Sort order**: items in random order, tap to place into numbered slots. Same interaction model as word bank for consistency. See `sortOrderContentSchema`. Should we use drag and drop here? Thoughts?

Check with the `design-architect` agent to determine the best interaction model for the sort order step, considering the user experience and consistency with other interactive elements.

E2E tests for both.

**Key files**: `packages/core/src/steps/content-contract.ts`

### Issue 14: Select image step

Image grid from options. Tap to select (single-select). Each option has an image URL and prompt text (we use the prompt text as `alt`). Fallback for missing/broken image URLs: show the prompt text in a styled placeholder.

Double-check with the `design-architect` agent to see what's the best design for this.

See `selectImageContentSchema` in `content-contract.ts`. E2E test.

**Key files**: `packages/core/src/steps/content-contract.ts` (selectImageContentSchema)

## Phase 4: Visual Renderers

### Phase 4a: Visual Registry (after Issue 1)

### Issue 15: VisualRenderer registry + architecture

Build the `VisualRenderer` registry component that maps `visualKind` to renderer. This is the architecture foundation for all 7 visual kinds (code, image, table, chart, diagram, timeline, quote).

- Graceful fallback for unsupported/unimplemented kinds (render nothing, log warning)
- Wire visual rendering into `StaticStepLayout` (replace the visual placeholder) and `InteractiveStepLayout`
- Consult `design-architect` for layout decisions that accommodate all 7 visual kinds across different screen sizes
- Design the shared container/wrapper that all visual renderers will use
- Each unimplemented kind shows the graceful fallback until its dedicated issue is completed
- E2E test: verify fallback behavior for a step with a visual kind

**Key files**: `packages/core/src/steps/visual-content-contract.ts`

### Phase 4b: Visual Kind Renderers (parallelizable after Issue 15)

Each visual kind issue should:

- Consult `design-architect` agent for the best design for that specific kind
- Focus on great UX on both large and small screens (mobile)
- Prioritize clarity and readability (these are learning aids, not interactive elements)
- Include e2e tests for the visual rendering
- Follow the container/wrapper pattern established in Issue 15

### Issue 16: Image visual renderer

Next.js `<Image>` with fallback placeholder for broken URLs.

i wonder if images should use full bleed? use full width and all available height? check with the design-architect agent on how this should look like

**Key files**: `packages/core/src/steps/visual-content-contract.ts`

### Issue 17: Quote visual renderer

Styled blockquote with optional author attribution.

**Key files**: `packages/core/src/steps/visual-content-contract.ts`

### Issue 18: Code visual renderer

Syntax-highlighted block with support for multiple programming languages. Since we use this app to teach anything, there could be a wide variety of programming languages. Dynamic loading if needed to reduce bundle size (check `vercel-react-best-practices` and `next-best-practices` skills).

**Key files**: `packages/core/src/steps/visual-content-contract.ts`

### Issue 19: Table visual renderer

Responsive table with horizontal scroll for wide tables.

**Key files**: `packages/core/src/steps/visual-content-contract.ts`

### Issue 20: Timeline visual renderer

Vertical timeline with connected dots and event descriptions.

**Key files**: `packages/core/src/steps/visual-content-contract.ts`

### Issue 21: Chart visual renderer

Use the chart library already installed in the project. See supported chart types in the AI package task generation for visual kinds.

**Key files**: `packages/core/src/steps/visual-content-contract.ts`

### Issue 22: Diagram visual renderer

Simple nodes + edges layout, may use a library. diagrams can be huge. i wonder if we should make them bleed (full width and height) to give them more room? check with the design-architect agent on how this should look like

**Key files**: `packages/core/src/steps/visual-content-contract.ts`

## Phase 5: Language Steps (after Issues 3, 4, 12, 23)

### Issue 23: Vocabulary step

For `language` lessons we have a `vocabulary` activity, which has `vocabulary` steps kinds. We need to show `word.translation` (user's language) as the prompt and ask them to translate it. Then, we show 4 options: the correct `word.word` (target language) + 3 random distractors from the lesson word pool (shuffled), excluding similar words.

Distractor selection should use `getDistractorWords()` from `@zoonk/core/player/distractor-words`. The function handles:
- Same-translation filtering (e.g., two words both translating to "boa noite")
- Alternative translation filtering (e.g., "hi" and "hello" as alternatives)
- Bidirectional synonym detection

We should reuse components from multiple choice steps. However, here, when clicking/selecting an option, we should also play the associated audio for that word (using `word.audioUrl`).

Vocabulary steps are a bit different: we don't have a `feedback` message, so there's no point displaying a feedback screen. Instead, we should maybe inline the feedback after clicking on the "check" button? Eg show if it's correct or not, maybe change border to green if correct and red if incorrect, then green for what was the correct option, similar to how Duolingo does it. Check with the `design-architect` agent to see what's the best design for this feedback state for vocabulary steps.

See Word model fields and the plan's "Language Step Data" section for translation directions. Add E2E tests.

**Depends on**: Issues 3, 4, 12
**Key files**: vocabulary-related Prisma models, `apps/main/src/data/activities/get-activity.ts`

### Issue 24: Reading + listening steps

**Reading step**: show `sentence.translation` (user language) as prompt. User arranges words from `sentence.sentence` (target language) using the WordBank from Issue 12. Add distractor words from the **lesson word pool** (`lessonWords`), not from splitting other sentences. Use `getDistractorWords()` from `@zoonk/core/player/distractor-words` to filter the word pool before adding distractors to the word bank. This gives better distractor quality (curated vocabulary items vs. arbitrary sentence fragments). Make sure to remove duplicated words.

**Listening step**: play `sentence.audioUrl` (target language) via AudioPlayer from Issue 23. User arranges words from `sentence.translation` (user language) using WordBank. Make sure to remove duplicated words. Fallback for null `audioUrl`: show sentence text instead of audio.

Translation directions per plan's "Language Step Data" section. E2E test.

**Depends on**: Issues 3, 4, 12, 23
**Key files**: Sentence model, WordBank component from Issue 12, AudioPlayer from Issue 23

## Phase 6: Progress & Challenge

### Issue 25: Activity completion server action

`submitActivityCompletion` server action that:

1. Reads session from `headers()` server-side (server actions can read headers, unlike `"use cache"` pages). Returns early for unauthenticated users.
2. Re-validates answers server-side: re-parses step content from DB via `parseStepContent()`, re-checks with `checkAnswer()`. Does NOT trust client-sent `isCorrect` values (prevents BP spoofing).
3. Creates `StepAttempt` records for each step.
4. Upserts `ActivityProgress` with completion status and score.
5. Updates `UserProgress` (BP + energy, energy clamped [0,100]).
6. Upserts `DailyProgress`.
7. Calls `revalidateTag` for cache invalidation.

Must be idempotent/retry-friendly. Integration tests.

**Note from Issue 8**: `submitActivityCompletion` should return the user's updated belt level so the completion screen can show `BeltIndicator` with correct belt color and detect level-ups. Currently showing "+10 BP" text only. We should give users a sense of progress, something like XX BP to the {color} {level}. Check with `design-architect` agent to see what's the best design for this element on the completion screen in a way that looks nice but also motivates users to keep going.

For energy level, users get +0.2 for correct answers and -0.1 for incorrect answers. We need to update the current hard-coded value to show the correct energy change on the completion screen.

**Depends on**: Issues 2, 4, 9
**Key files**: progress-related Prisma models, `packages/core/src/steps/content-contract.ts`

### Issue 26: Challenge dimension tracking + result screen

Add dimension inventory state to the player reducer (from Issue 5). Track dimension changes as users answer challenge steps.

- `DimensionPills` component below header: `Badge` components with +/- icons for accessibility (not color alone). Animate changes on feedback screen (300ms CSS transition).
- Challenge intro/reflection are now stored as static steps (first/last) — no `activity.content` parsing needed. The player renders them like any other static step.
- Challenge result: win/fail based on no dimension going negative. Show dimension summary, energy penalty on fail.

See `challengeOptionSchema` in `content-contract.ts` for the effects structure. E2E test.

**Depends on**: Issues 1, 5, 9, 11
**Key files**: `packages/core/src/steps/content-contract.ts` (challengeOptionSchema)

### Issue 27: E2E - comprehensive integration flows

Review the entire playthrough scenarios exercising multiple step kinds in single activities and check if we have all necessary e2e tests to ensure robust coverage of realistic user flows. For example (but not limited to):

1. **Core activity**: static reading steps → quiz → fill blank → completion with BP display
2. **Language activity**: vocabulary → reading → listening → completion
3. **Guest flow**: play through, see score, see login CTA (no BP saved)
4. **Challenge activity**: intro screen → dimension pills → quiz with consequences → win/fail result

These complement the per-issue E2E tests by testing realistic multi-step flows end-to-end. Make sure we're not missing anything like edge cases, error handling, or important user interactions. Add any missing tests as needed.

**Depends on**: all previous issues
**Key files**: `apps/main/e2e/`
