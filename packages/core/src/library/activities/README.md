# Activity engine

Activities are templates the writer picks and fills, never code per lesson. An `activity` step's content is:

```ts
{
  template: "formulaModel",          // one of the 35 templates
  prompt: "Move the rate...",        // the instruction at the top
  fields: { ... },                   // what the writer fills, per template
  check: { kind: "choice" | "numeric" | "interaction", ... },
  data?: { source: { title, publisher?, url?, year? } } | { isExample: true },
}
```

## Checks

Every activity has a check tied to what the learner does ("useful, never decorative"):

- `interaction`: the end state of the interaction is the answer. Code computes it from the fields (`computeExpected`): timelines sort by date, Punnett squares combine alleles, traces give the value at each pause.
- `numeric`: a number the learner produces by moving or placing something. Code recomputes it (`computeValue`) and the validator rejects an `answer` that doesn't match. `inputs` put the sliders where the question asks and `output` names what to read.
- `choice`: a question about what the learner saw. When options carry a `value`, the option closest to the computed number must be the correct one.

`checkActivityAnswer(content, answer)` grades a learner's answer with the same computed values, so the player and the server can't disagree.

## Formulas

Formulas use the safe expression language in `expression/`: numbers, variables, `+ - * / ^`, parentheses, unary minus, `pi`, `e`, and the functions `abs acos asin atan cbrt ceil cos deg exp floor ln log log10 log2 max min rad round sign sin sqrt tan`. `log` is the natural logarithm and trig uses radians (`rad(45)` converts degrees). It parses to an AST and never runs code. Evaluation returns `{ ok: false, error }` instead of throwing, and `sampleExpression` evaluates a formula across every slider range before publishing.

## Validation

`validateActivity(content)` runs before publishing and returns `{ ok: true, content }` or `{ ok: false, issues }`. Issue codes: `invalidSchema`, `unknownTemplate`, `missingCheck`, `checkNotAllowed`, `missingInteraction` (nothing to move, order or find), `formulaFails`, `answerMismatch`, `missingDataSource`, `inconsistentFields` and `unknownAsset` (a base map that isn't in core's checked library, `base-maps.ts`). Messages say what to fix, for the writer's repair step.

## Code activities

Code runner, code tracer and SQL playground answers are computed by running the code, not taken from the writer. `verifyActivityPrograms` (in `programs/`, called by the lesson quality gate) runs a code runner's `solution` and requires `expectedOutput` to be exactly what it prints (and the starter code not to print it already), replays a code tracer's program and requires its trace to match the run, and runs a SQL playground's `solution` and requires the expected rows. Its issues use the validator's format, with `programFails` for code that errors, loops or floods. It grades those runs with `checkActivityAnswer`, so they pass exactly when a learner doing the same would.

JavaScript, Python and SQL never run in the server's own process. Each batch goes to a separate Node process started with no environment variables, read access only to the runtimes' files, no child processes or workers and no code generation from strings; inside it JavaScript runs in QuickJS (`quickjs-wasi`), Python in Pyodide (loaded only when a lesson has Python) and SQL in sql.js, all WebAssembly, with network and host globals removed. Time and output limits are the player's (`program-limits.ts`), and the player's browser sandbox shares the console formatting (`console-values.ts`), SQL setup and Python error parsing, so the check and the player print the same program the same way. SQL has only SQLite's own functions (`log` is base 10), without sql.js's legacy extensions (`SQL_JS_CONFIG`). Every client runs queries on this same sql.js, the iPhone's worker included, since another SQLite build (Apple's system one) has other functions and syntax and rounds some math results differently, and answers are graded by exact rows.

## Engines with modes

A template is a generic engine, never one topic: the formula model covers calculators, physics simulations and what-if scenarios; lines and their crossing covers supply and demand, break-even and two equations; the combination grid covers Punnett squares, dice and times tables. When an engine's modes differ, its rules can depend on a screen's fields: `checksFor` narrows the check kinds, and `needsData` and `choicesNeedValues` take a function of the fields.

## Adding a template

1. Define it with `defineActivityTemplate` in the area file under `templates/`: `id`, a `description` for the writer's prompt ("Fills: ..."), the `fields` zod schema, the allowed `checks` and `needsData`.
2. Add the hooks its checks need: `expected` for `interaction`, `value` for `numeric` (and choices with values), `formulas` for anything the validator must sample, and `verify` for consistency rules, including a `missingInteraction` issue when there is nothing to do.
3. Add it to `activityTemplates` and `activityContentSchema` in `activity-templates.ts`.
4. Add a valid fixture to `activityContentFixtures` in `@zoonk/testing/fixtures/activity-contents` (the validator test won't compile without one for every template, and proves each one publishes) and a rejection case for its own rules in `validate-activity.test.ts`. E2E lessons, the dev seed and evals reuse the same fixtures.
5. Build its renderer in `@zoonk/player` (see `packages/player/src/activities/README.md`). The player's registry is typed over every template id, so a template doesn't compile without a renderer and the writer can offer the whole catalog. Keep fields to what the AI writes: code draws what must be exact and computes the answers.

Java, C++, Go, Rust, Swift, TypeScript, C#, Kotlin, PHP and Ruby run in network-denied Vercel Sandbox forks. Each fork starts from the language's toolchain snapshot, a base named `code-{language}-{hash}` by a hash of everything its build puts in it: the install recipe, the run wrapper and the programs that warm its caches. Lesson publication uses the same commands and output limits to check the solution and starter code. A learner's run returns a run ID, and lesson checks and mistake practice grade the stdout Core measured for that learner and language.

Staging and production provision their API project's bases before deploy. To build selected bases locally, link the API project, run `vercel env pull` there, and run `pnpm --filter @zoonk/core sandbox:build cpp java --verify-fork` from the repository root. Leave out the language arguments to build all ten. The script installs and warms each toolchain, checks a working program and a syntax error, then stops the base to produce its snapshot. With `--verify-fork`, which every deploy passes, it then forks each base the way a learner's run does and fails unless the learner can't use sudo, write the sandbox's, staging, wrapper or system directories, find setuid programs beyond the expected set or connect out, and a run past its limit reports a time-out. Sandbox-language evals need the API project's OIDC token in the process environment. JavaScript, Python and SQL checks run locally without it.

Changing any of those names a new base, which the next deploy builds, and a preview with a changed recipe builds its own instead of the one production forks. Before merging a toolchain update, recheck the published activities for that language (both solution and starter) against the new base. Delete an old base after the release that used it is gone.
