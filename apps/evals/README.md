# Zoonk Evals

The internal app and command-line tools that decide which model, reasoning level or prompt each Zoonk AI task runs.

## What decides a model

- **Code checks** decide tasks whose output code can check fully (classifiers, extractors, schemas, answer keys). They report accuracy, per-label results for classifiers, cost and latency.
- **Comparisons** decide tasks with subjective quality (lessons, plans, explanations, images). A comparison puts a challenger against the incumbent on the same frozen cases. Readers from different model families read each pair blind and say which serves the learner better and what they saw. The problems that would decide are verified against both outputs. The decision weighs quality against cost and wait by the task's written `priorities`. See [Comparing two variants](#comparing-two-variants).
- **Scores** from the judge model still exist for judged text tasks and for images, but a score decides nothing by itself. See [What scores are still for](#what-scores-are-still-for).

Costs use the AI Gateway's price list, including cached input and reasoning tokens, plus what the gateway charges on top, such as its search fees. Judge and reader calls are priced too.

## Running the App

From the root directory of the repository, run:

```bash
pnpm evals
```

This builds the evals app and starts it at `http://localhost:3201`. From there you can run evals for any model and task, read a task's comparisons and do your own blind reads.

## Adding a New Task

Adding a new task to the eval system requires no changes to the core evaluation code. Simply:

1. **Create a test cases file** in `src/tasks/[task-name]/test-cases.ts`:

```typescript
export const TEST_CASES = [
  {
    id: "unique-test-case-id",
    userInput: { language: "en", prompt: "your test input" },
    expectations: `
      - expected behavior 1
      - expected behavior 2
    `,
  },
];
```

**Important**: Each test case must have a unique `id`. This ensures that when re-running evals after a partial failure, only the missing test cases are executed, preventing duplicates.

Every task needs cases in English and Portuguese (see [Language Coverage](#language-coverage)). A case's language comes from its own `language` field, then `learnerLanguage` or `language` in `userInput`, then an id that starts with a language code (`pt-enem-math`). Set `language` on the case when the input doesn't carry one, such as a goal typed in Portuguese.

2. **Create a task definition** in `src/tasks/[task-name]/task.ts`:

```typescript
import { generateYourFunction } from "@zoonk/ai/your-task/generate";
import { TEST_CASES } from "./test-cases";
import type { Task } from "@/lib/types";

export const yourTask: Task<YourInput, YourOutput> = {
  id: "your-task-id",
  name: "Your Task Name",
  description: "Brief description",
  testCases: TEST_CASES,
  generate: generateYourFunction,
};
```

For structured classifier or extractor tasks, add `expected` data to each test case and a task-level `score` function. Use deterministic scoring when the output can be checked by parsing fields and comparing them to an explicit accepted list. Leave `score` unset for open-ended generation tasks that need the judge model.

For classifiers, set `reportsLabels: true` on the string-field scorer (or return `classification` from a custom scorer) so results show accuracy per label and a confusion matrix, not only an average.

Every task sets `priorities`, one line each: who reads the output (`reads`), who waits for it (`waits`), whether it's `shared` or `private`, what comes `first` (quality, cost or latency) and the `reason`. A comparison won't start without them. See `lesson-spec/task.ts`.

A task with subjective quality also sets:

- `criteria`: what readers look for, each with an id, a label and its `expectations` (what to notice and what it costs the learner, with no scoring instructions). Tasks whose output a learner reads add the shared plain-language criterion from `src/tasks/plain-language-criterion.ts`.
- `priorities.comparison`: for each criterion, whether a verified major problem under it `disqualifies` the variant (a wrong answer key) or `counts` toward the trade (clarity, fit); whether overall preference `canBlock` a cheaper challenger or only `separates` two eligible ones; and the `trade` the task accepts (the largest rise in major-affected cases per 100 for a given saving in cost share or seconds). Leave `trade` as `null` until the owner sets it: the decision then reports the confirmed major cases on each side instead of applying a trade.

Judged tasks still declare a weighted rubric with `defineScoreCategories` as their `scoreCategories`, as `skill-graph` does. Weights must total 100; the judge scores each category on its own. Readers get `criteria`, never the weights.

When learners wait on the task, set a `latencyBudget` (`{ p50, p95 }` in seconds), as `step-variant` does. A model counts as a fit only when both its p50 and p95 are within the budget. See [Latency Budgets](#latency-budgets).

To compare evaluation models on a classifier, add an `evaluate` route next to `generate`. `createChoiceEvaluation` and `createBooleanEvaluation` (in `src/lib/evaluation-routes.ts`) run the classifier the task exports next to its generation function (such as `courseIntentClassifier`) and map the answer back to the task's output, so the same scorer grades both kinds of model.

3. **Register the task** in `src/tasks/index.ts`:

```typescript
import { yourNewTask } from "./your-task/task";

export const TASKS = [courseRequestRoutingTask, yourNewTask];
```

That's it! Your task will automatically appear in the dashboard.

## Supported Models

Models are configured in [src/lib/models.ts](./src/lib/models.ts). Each one has a kind:

- `generation` models run the task's own prompt through `generate`.
- `evaluation` models run the task's `evaluate` route through the AI SDK's `experimental_decide`: the gateway's decision models (Jev, GPT-6 Luna Decisions, Liquid d1) natively, and Luna, Flash Lite and Haiku through the SDK's language-model decision adapter (their ids end in `/evaluation`). They only appear for tasks with an `evaluate` route.

Prices come from the same list the apps price every AI call with: the AI Gateway's model list, saved in `packages/ai/src/pricing/gateway-prices.json` with the time it was fetched. Refresh it after adding a model or when prices change:

```bash
pnpm --filter @zoonk/ai prices:refresh
```

Eval runs use the apps' default provider too, so Anthropic and OpenAI models read their system prompts from the prompt cache.

## Running Evals From the Command Line

`eval:run` runs tasks for several models one after another and prints a table per task with accuracy per label, the English and Portuguese results apart (accuracy for classifiers, the average score otherwise, with the case count), p50 and p95 latency, whether each model meets the task's latency budget, and cost. Outputs and scores are saved in `eval-results` like dashboard runs.

```bash
pnpm --filter evals eval:run --task course-intent --model typesafe-ai/jev --model openai/gpt-6-luna --limit 40 --fresh
```

- `--limit` samples that many cases spread across expected labels and languages.
- `--language` keeps only cases in those languages, such as `--language en --language pt`.
- `--case` keeps only cases whose id contains one of the given texts, such as `--case :parallel` for the production search tool in `find-official-sources`.
- `--fresh` regenerates the sampled cases even if saved outputs exist, so every model's latency is measured the same way. Without it, only cases with no saved output are generated.
- `--saved` prints the same table from saved results without calling any model.
- `--runs <n>` runs each sampled case `n` times and counts every run in the table, so a failure that only happens sometimes shows up. Model comparisons use it: a miss in 1 call out of 5 often passes a single run.
- `live-conversation` runs on `openai/gpt-live-1` only. It plays each case's practice call over GPT-Live's server WebSocket with the production instructions and cues: a text model plays the learner from the case's plan and sends each line as the app's typed reply, and the production objective check runs after each answer. When a check finds a new goal met, its note for the character goes out with the learner's next line, as the app sends it, and anything the character says while the learner is still writing fails a code check. GPT-Live bills per second of session, so "Cost / 1k runs" is the voice alone, and "Spent" adds the learner's model, the objective checks and the judge. Cases with a `learnerNote` (`--case=-memory-`) also score how the character used the learner's note.

Generation runs at most four calls at a time so a model's own requests don't slow each other down. "Spent" is what the run paid. Every text and decision model call counts as it ends, so an answer that then fails its schema or a task's checks, or that a task retries, still counts. Images (with their per-image fee) and GPT-Live seconds count from the outputs the run wrote. Saved outputs and scores the run reuses cost nothing again; with `--saved`, "Spent" is what the sampled cases' saved outputs and judge calls cost. A run that fails prints what its model calls cost before the failure. A run scores only its sampled case runs, so an older run number left in an outputs file is never judged. A model's own search fees, which its provider bills to our key (`find-official-sources`'s `native` cases), speech and transcription calls, image or GPT-Live calls that fail, and decision calls whose answer fails validation aren't included.

A saved output's cost is every text call its run made, including drafts it set aside; an output saved before runs were metered counts only its kept answer. A case run that fails keeps its calls beside the outputs: `--saved` counts them in "Spent", and "Cost / 1k runs" spreads them over the runs that succeeded.

## Language Coverage

`eval:languages` lists every task's cases per language and how many came from production samples. It fails when a task has no English or no Portuguese case, or a case whose language can't be told. Code Quality runs it on every pull request:

```bash
pnpm --filter evals eval:languages
```

A task that never runs in one of them says why in `skippedLanguages`, as `word-ipa` does for English: language audio asks for IPA only for words of other languages. The check prints the reason instead of failing.

## Comparing two variants

`eval:compare` answers one question for one task: should the challenger (a new model, reasoning level or prompt) replace the incumbent (what production runs today)? The [model-check skill](../../.agents/skills/zoonk-model-check/SKILL.md) says when to run one and how to decide; this section is how to run it. Everything a comparison uses and finds is saved in `eval-results/comparisons/<task>/<id>/`, so a later reader can check the decision without running anything.

### From forecast to decision

```bash
pnpm --filter evals eval:compare --task lesson-spec --id gpt-6-2-sol \
  --incumbent openai/gpt-6.1-sol --challenger openai/gpt-6.2-sol@current \
  --question "Should GPT-6.2 Sol replace GPT-6.1 Sol for shared lesson plans?"
```

One command runs every stage in order and stops where you ask (`--stop-after freeze|seal|checks|packet|reads`):

1. **Forecast.** Before anything is generated or read, it prints what the challenger's generation will cost (from the task's measured cost per run) and what each reader will cost by channel, with reverse and reserve reads priced apart. It stops when the forecast passes `--limit-usd` (default $1); add `--confirm` to go past it.
2. **Freeze and generate.** It freezes the cases (`--case` to limit them), their inputs and expectations, then generates the challenger, two runs a case (`--runs`). Write the challenger as `model@current` to generate with today's prompt, `model@<variant hash>` for saved outputs of an exact variant, or `sealed:<comparison id>:<incumbent|challenger>` to reuse a side of an earlier comparison. Incumbent outputs are reused only when their prompt and input hashes match; a missing match is reported, never filled in from another prompt. `--saved-only` never generates.
3. **Seal.** The outputs, packets, controls, protocols and priorities are stored by hash before anyone reads them. `--seal-only` stops here and costs nothing, which is how you freeze saved outputs for a later read.
4. **Code checks** run on both sides. For item tasks this includes an independent solve of every answer key. A hard failure on the challenger alone (a wrong key, a broken schema) ends the comparison.
5. **Reads.** Each reader reads each pair blind, as A and B, with no tools and no model names. Every packet carries two controls: the same output twice (the right answer is a tie) and a known defect from the control bank (`--bank`, default the task's own in `eval-results/controls/`). A packet whose reader fails a control doesn't count; the attempt is kept. A case the readers leave unresolved gets a reverse-order read in a fresh session, then the reserve reader if one could settle it.
6. **Verification.** Only the major problems that could change the outcome go to a verifier from another family, with both outputs and the case's expectation side by side. Each batch carries a false allegation the verifier must reject.
7. **Decision.** It prints the decision table and saves `decision.json`: coverage, cases with a verified major problem on each side (English and Portuguese apart), wins, losses, ties and unresolved cases, cost per 1,000 deliveries and p50 and p95 wait, and the outcome: **switch**, **retain**, **neither qualifies** or **insufficient evidence**. When unresolved cases, unverified claims or missing matches could reverse the choice, the outcome is insufficient evidence and the incumbent stays.

Leave out `--incumbent` for an audit: readers list problems in one variant's outputs, with no preference.

### Readers

Pass one reader per family with `--reader <channel:model>`; Claude and GPT readers are required. Without `--reader`, the defaults in `scripts/compare.ts` apply. Before choosing a reader for a task, look at how it did on its controls in the comparisons already saved for that task family: a reader that misses planted defects on packets as long as yours (lesson-length packets are long) doesn't count.

- **Seats.** `seat:anthropic/<model>` reads through the Claude command-line client on a subscription, at no gateway cost. The client runs in an empty folder with its tools off and no project or user settings; if it can't sign in, run the model or start isolated, the read goes through the gateway and the log says why. Near the seat's limit, the run waits for a reset within 4 hours and otherwise uses the gateway. Only Claude reads on a seat today; GPT and Gemini read through the gateway.
- **Choosing the Claude login.** The client uses your default Claude login. To read on another one, point `CLAUDE_CONFIG_DIR` at that login's folder for the command, such as `CLAUDE_CONFIG_DIR=~/.claude-work pnpm --filter evals eval:compare ...`.
- **Gateway.** `gateway:<provider>/<model>` reads through the AI Gateway and records its cost.
- **Reserve reader.** A third family (Gemini 4 Neon unless `--reserve <model>` names another) reads every pair when the rivals are a Claude model and a GPT model. Otherwise it is a tie-breaker: it reads only an unresolved case whose result could change the outcome. It is the most expensive reader per packet, so cap it with `--reserve-cap <calls>` (counted across attempts, including interrupted ones), or skip it with `--reserve none`. The reserve model is fixed when the comparison is sealed; to change it, start a new comparison.

Images are read by vision readers through the gateway, and the image judge's named flaws are shown beside them (see [What scores are still for](#what-scores-are-still-for)).

### Resuming

Run the same command with the same `--task` and `--id` to continue. A sealed comparison never regenerates or reseals: it picks up at the first stage that isn't done, and a read that was already saved isn't counted twice. Only one process can run a comparison at a time. Use `--attempt <name>` to label a new round of reads, for example after a reader failed its controls.

### Export and import a packet

A packet can be read outside the command, by a person or an agent:

```bash
pnpm --filter evals eval:compare --task lesson-spec --id gpt-6-2-sol --packet <id> --export packet.json
pnpm --filter evals eval:compare --task lesson-spec --id gpt-6-2-sol --packet <id> --import response.json --cost-usd 0.01
```

Run either without `--packet` to list the packets you can choose. The export holds the packet, the reader instructions, the response schema and any images. An import must match that schema; `--cost-usd` records what a model's read cost. The owner's packet (one pair per case, no controls) can be exported and imported the same way.

### Reading a comparison in the app

Each task's page lists its comparisons, newest first, with their current outcome. A comparison's page shows the outcome and its reason, the decision table, what the task values, and the cases, unresolved ones first. Open a case to see both outputs side by side, every reader's verdict and the problems they quoted, and whether each was verified.

For shared content, read the decisive cases yourself before a switch. On the comparison page, start the blind read: one pair per case, as A and B, with the model names hidden and pictures you can open full screen and flip between. Say which serves the learner better and why, and note any problem you see. After you save, the page reveals which side was which and how the readers voted.

- Your blind read settles a case the readers left unresolved.
- A problem you mark as major counts right away on that side, without a verifier.
- Once every reader has voted and a case is still unresolved, you can also give a ruling with the names shown. The later of your blind read and your ruling is the one that counts. A ruling doesn't count toward how often readers agree with you.

## What scores are still for

The judge model (GPT-6.2 Astra for text, Claude Opus 5.5 for images) still scores judged tasks out of 10, and the leaderboard still shows those scores. Each saved result records its judge; results saved before 18 Nov 2026 come from GPT-6 Astra, which scores about 0.19 higher, so compare scores from the same judge only.

- A score doesn't decide a model. On the 18 Nov sweep it picked the opposite winner from blind readers as often as the same one.
- Use a score to spot a case worth reading, a regression in a task's own runs, or a model clearly worse than the rest.
- For images, read the problems the judge names before its number: it named every planted flaw in a measurement, while its number barely separated close models. Models are chosen by blind pairs with vision readers.
- Audio tasks keep their checks: `assess-pronunciation` and `transcribe-speech` gate by their scores, and `check-word-pronunciation` is decided by its cases.

Classifiers still need about 85% accuracy in English and in Portuguese. Case counts per language are small, so rerun a task before trusting a single miss.

## Latency Budgets

A model can win a task only when it meets the task's latency budget, which the task's `priorities` reuse. Budgets are tight where learners wait on the answer and absent for work made ahead of time:

| Task                | p50  | p95  | Why                                                                                                                |
| ------------------- | ---- | ---- | ------------------------------------------------------------------------------------------------------------------ |
| `quick-explanation` | 12 s | 18 s | The first screen should show in about 20 seconds, and the generality check, the save and the page load come on top |

Measure latency with `--fresh` when nothing else is running.

## Sampling Real Inputs

Test cases should come from what learners and the pipeline actually produce. `sample:production` reads a local database (it refuses any other host): the `zoonk` dev database by default, or `zoonk_prod_copy`, the local copy of production. It replaces emails, links, phone numbers and user names and writes `datasets/production-inputs.json`, which git ignores:

```bash
pnpm --filter evals sample:production --limit 50 --database-url postgresql://localhost:5432/zoonk_prod_copy
```

Each section is sampled equally across what production recorded (and language), so rare labels still show up:

| Section              | From                                                                   | Recorded label and provenance                                                    |
| -------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `goals`              | Goals typed in onboarding                                              | The goal kind                                                                    |
| `goalUnderstandings` | What onboarding understood from a typed goal                           | The route and result, with model and prompt version                              |
| `tutorQuestions`     | Tutor questions and answers                                            | The screen or answer they were about, with model and prompt version              |
| `typedAnswers`       | Typed answers to lesson and item questions                             | Whether grading accepted them, with the model and prompt version of the question |
| `evaluationRuns`     | The evaluation-model log (Jev's verdicts), where the input may be kept | Each question's answer and probability, with model and prompt version            |

A section is skipped when the database predates its table, and provenance is empty where it predates those columns.

The labels in that file are what production recorded, not ground truth. Label cases by hand before using them as `expected` values, and mark them `origin: "production"` so `eval:languages` counts them (as `course-intent` and `question-generality` do).

## Shared Learner Dataset

Tasks that take learner context (example lines, memory relevance and reconcile, plan edits, mistake causes and goal understanding) also run cases built from the seed learners that E2E tests and screenshots use: Maya, Sam and a guest in English, and Ana, Lucas, Pedro and Marcos in Brazilian Portuguese. `src/datasets/seed-learners.ts` reads them from `@zoonk/db/seed/personas` on a fixed Monday (`SEED_LEARNERS_TODAY`) and gives each task their goal as typed and planned, their memory facts, the explanation screens of their lessons and the mistakes in their notebook. Each task's `persona-cases.ts` picks from it and labels the expected result by hand; case ids read `<language>-persona-<learner>-…`.

When the seed changes a learner, lesson, fact or mistake a case points at, loading the task throws with the missing piece, so the case changes with the seed instead of silently testing something else.

## Production Evidence

Two commands read production through the staff CLI, so they need a platform admin's login first (`pnpm zoonk login`):

- `eval:gate-rates` reports how often each lesson writer passed its quality review, how often a review was skipped, and the problems it found most, from the recorded quality decisions. It covers the last 7 days unless you pass `--from` and `--to`.
- `sample:library` samples published shared Library lessons as eval cases marked `origin: "production"`, with the model and prompt version that wrote them, into `datasets/library-sample.json` (`--limit`, `--out`, `--seed`). Never a learner's own data.

```bash
pnpm --filter evals eval:gate-rates --from 2026-11-01
pnpm --filter evals sample:library --limit 12
```

## Removing Test Cases

To rerun some cases from scratch, remove their saved outputs and results for every model. Pass each case id with its run number, as saved:

```bash
pnpm evals:remove course-intent topic-biology-1 topic-biology-2
```

Run it from the root of the repository. It doesn't touch comparisons, which keep their own copies of the outputs they read.
