<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Evals

## Choosing a model

An eval's job is to find the cheapest model that serves the task as well as a pricier one, judged by what the task values. Each task writes that down in its `priorities` (`task.ts`): who reads the output, who waits for it, whether it's shared or private, and whether quality, cost or latency comes first and why. The [model-check skill](../../.agents/skills/zoonk-model-check/SKILL.md) is the procedure.

- Never test one model alone. Run the task on models from different families (at least OpenAI, Anthropic and Google), picked from the AI Gateway's current catalog.
- Work from the bottom up. Start with each family's cheapest model and move one tier up only when the one below isn't good enough. For OpenAI, that's Luna, then Terra, then Sol, then Astra.
- Private content serves one learner and can't spread its cost, so it takes the cheapest model that keeps good quality. Shared content is reused, so it can afford a pricier model when quality needs it.
- A tie goes to the cheaper model. The task’s `priorities` set the trade for a small quality loss. Major problems count at weight 1 by default and factual errors at 3. Unsafe content and following instructions planted in learner input can disqualify.
- Compare models by their measured cost per run on the task, never by per-token price: models spend very different token counts on the same input.
- Run every case several times and count each failure across runs: the same model can pass a case once and fail it the next time, so one clean run doesn't show a rare miss. A decision that would rest on a handful of cases first adds cases that cover the task's fields and edge cases.
- Tasks whose output code can check fully (classifiers, extractors) are decided by their code checks. Tasks with subjective quality are decided by a comparison: the challenger against the incumbent on the same frozen cases, read blind in pairs by readers from several families, with the observations that would decide verified against both outputs. Report quality, cost and latency for every model tried, including the ones you rejected.
- Independently solve every answer key on both sides. A wrong key counts at weight 3. A failed code check rules a variant out only when production rejects the output and saves nothing usable. First-draft failures that production sends to a fixer count as major problems under their criterion, including the written lesson's code gate.
- For anything a learner reads, being easy to follow counts as much as being right: everyday words, examples from everyday life, something a person with no background follows. An accurate output that reads academic or dull loses.
- What decides: code checks, cases where readers from two families agree, problems a reader from a second family verified against both outputs, cost and wait measured on the same cases, and for shared content the owner's blind read of the decisive cases. Nothing else decides alone: a judge score picked the opposite winner from blind readers as often as the same one, and one blind read is noise (two readers comparing two runs of the same model each picked a winner almost every time and never agreed on which).
- "Insufficient evidence" is a real outcome. When unresolved cases, unverified claims or missing matches could reverse the choice, the incumbent stays.
- A reader counts only after it passes its planted-defect controls on packets as long as the task's. The evidence is in the saved comparisons (`eval-results/comparisons/`) and the control banks (`eval-results/controls/`); check it there before choosing a reader. Each comparison also reports how often each reader preferred its own family.
- Readers from Claude and GPT read every pair. A third family reads every pair when the rivals are a Claude model and a GPT model; otherwise it's a capped tie-breaker for unresolved cases that could change the outcome, never a reader of every packet.
- The scoring judge stays until readers alone have passed their controls; its score informs and never decides. Image models are chosen by blind pairs with vision readers, and the image judge's named flaws matter more than its number. Audio tasks keep their checks.
- Before switching a model for shared content, the owner reads the decisive cases blind in the evals app. Private content switches on shown practical equivalence.
- The comment beside a model says why it was chosen and cites the comparison that chose it.

## Regression cases

- Every AI failure found while testing (persona walks, manual checks, comparisons, bug reports) becomes a test case on the task that produced it, in that task's `test-cases.ts`, added with the fix. The case uses the input that triggered the failure and states the expectation it broke. A verified observation from a comparison that recurs or matters becomes a case, an expectation or a code check the same way.
- A real input the task fails is the case to keep. Never swap it for an easier input to make an eval pass: a failing case is the eval doing its job. Fix the task or the pipeline and keep the case.
- When code can verify the flaw, the task's scorer reuses the validator the generation pipeline runs before saving (for example `@zoonk/utils/text-flaws` or `findSkillGraphProblems`), so evals and production judge output the same way. Otherwise, write the expectation so a reader can check it.
- New cases can come from published shared Library content (lessons, specs, challenges), read through the staff CLI and marked `origin: "production"`.
- Cases hold Library content, public documents and test learners' inputs, never a real learner's data.
- A changed case or prompt is a new input: outputs written before the change don't stand in for outputs after it.
- After changing a scorer or a case's expectations, rescore every saved model's results on the cases it affects, not only the models you're comparing, since the leaderboard reads saved scores as they are. A comparison keeps the expectations it froze, so check the change with a new one.
