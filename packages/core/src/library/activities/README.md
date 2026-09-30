# Activity engine

Activities are templates the writer picks and fills, never code per lesson. An `activity` step's content is:

```ts
{
  template: "sliderGraph",           // one of the 43 templates
  prompt: "Move the rate...",        // the instruction at the top
  fields: { ... },                   // what the writer fills, per template
  check: { kind: "choice" | "numeric" | "interaction", ... },
  data?: { source: { title, publisher?, url?, year? } } | { isExample: true },
}
```

## Checks

Every activity has a check tied to what the learner does ("useful, never decorative"):

- `interaction`: the end state of the interaction is the answer. Code computes it from the fields (`computeExpected`): timelines sort by date, Punnett squares combine alleles, decision trees are walked, traces give the value at each pause.
- `numeric`: a number the learner produces by moving or placing something. Code recomputes it (`computeValue`) and the validator rejects an `answer` that doesn't match. `inputs` put the sliders where the question asks and `output` names what to read.
- `choice`: a question about what the learner saw. When options carry a `value`, the option closest to the computed number must be the correct one.

`checkActivityAnswer(content, answer)` grades a learner's answer with the same computed values, so the player and the server can't disagree.

## Formulas

Formulas use the safe expression language in `expression/`: numbers, variables, `+ - * / ^`, parentheses, unary minus, `pi`, `e`, and the functions `abs acos asin atan cbrt ceil cos deg exp floor ln log log10 log2 max min rad round sign sin sqrt tan`. `log` is the natural logarithm and trig uses radians (`rad(45)` converts degrees). It parses to an AST and never runs code. Evaluation returns `{ ok: false, error }` instead of throwing, and `sampleExpression` evaluates a formula across every slider range before publishing.

## Validation

`validateActivity(content)` runs before publishing and returns `{ ok: true, content }` or `{ ok: false, issues }`. Issue codes: `invalidSchema`, `labelTooLong`, `unknownTemplate`, `missingCheck`, `checkNotAllowed`, `missingInteraction` (nothing to move, order or find), `formulaFails`, `answerMismatch`, `missingDataSource`, `inconsistentFields` and `unknownAsset` (a base map or diagram that isn't in core's checked libraries, `base-maps.ts` and `diagrams.ts`). Messages say what to fix, for the writer's repair step.

## Code activities

Code runner, code tracer and SQL playground answers are computed by running the code, not taken from the writer. `verifyActivityPrograms` (in `programs/`, called by the lesson quality gate) runs a code runner's `solution` and requires `expectedOutput` to be exactly what it prints (and the starter code not to print it already), replays a code tracer's program and requires its trace to match the run, and runs a SQL playground's `solution` and requires the expected rows. Its issues use the validator's format, with `programFails` for code that errors, loops or floods. It grades those runs with `checkActivityAnswer`, so they pass exactly when a learner doing the same would.

Programs never run in the server's own process. Each batch goes to a separate Node process started with no environment variables, read access only to the runtimes' files, no child processes or workers and no code generation from strings; inside it JavaScript runs in QuickJS (`quickjs-wasi`), Python in Pyodide (loaded only when a lesson has Python) and SQL in sql.js, all WebAssembly, with network and host globals removed. Time and output limits are the player's (`program-limits.ts`), and the player's browser sandbox shares the console formatting (`console-values.ts`), SQL setup and Python error parsing, so the check and the player print the same program the same way.

## Adding a template

1. Define it with `defineActivityTemplate` in the area file under `templates/`: `id`, a `description` for the writer's prompt ("Fills: ..."), the `fields` zod schema, the allowed `checks` and `needsData`.
2. Add the hooks its checks need: `expected` for `interaction`, `value` for `numeric` (and choices with values), `formulas` for anything the validator must sample, and `verify` for consistency rules, including a `missingInteraction` issue when there is nothing to do.
3. Add it to `activityTemplates` and `activityContentSchema` in `activity-templates.ts`.
4. Add a valid fixture to `activityContentFixtures` in `@zoonk/testing/fixtures/activity-contents` (the validator test won't compile without one for every template, and proves each one publishes) and a rejection case for its own rules in `validate-activity.test.ts`. E2E lessons, the dev seed and evals reuse the same fixtures.
5. Build its renderer in `@zoonk/player` (see `packages/player/src/activities/README.md`). The player's registry is typed over every template id, so a template doesn't compile without a renderer and the writer can offer the whole catalog. Keep fields to what the AI writes: code draws what must be exact and computes the answers.
