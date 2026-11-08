<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Evals

## Choosing a model

An eval's job is to find the cheapest model that matches a higher tier's quality on what the task needs.

- Never test one model alone. Run the task on models from different families (at least OpenAI, Anthropic and Google), picked from the AI Gateway's current catalog.
- Work from the bottom up. Start with each family's cheapest model and move one tier up only when the one below isn't good enough. For OpenAI, that's Luna, then Terra, then Sol, then Astra.
- First say what matters most for this task: quality when it needs the best output, cost when keeping spend down comes first, or latency when speed is critical. Then pick the best balance.
- When a cheaper model reaches the same or very similar quality, use it. It's usually faster too.
- Compare models on the same cases and scoring, and report quality, cost and latency for every model tried, including the ones you rejected.
- A model's labels tend to favor its own family. When hand labels decide between models, label blind with two families, then read the outputs where the leading models differ.

## Regression cases

- Every AI failure found while testing (persona walks, manual checks, eval runs, bug reports) becomes a test case on the task that produced it, in that task's `test-cases.ts`, added with the fix. The case uses the input that triggered the failure and states the expectation it broke.
- A real input the task fails is the case to keep. Never swap it for an easier input to make an eval pass: a failing case is the eval doing its job. Fix the task or the pipeline and keep the case.
- When code can verify the flaw, the task's scorer reuses the validator the generation pipeline runs before saving (for example `@zoonk/utils/text-flaws` or `findSkillGraphProblems`), so evals and production judge output the same way. Otherwise, write the expectation so the judge can check it.
- Cases hold Library content, public documents and test learners' inputs, never a real learner's data.
