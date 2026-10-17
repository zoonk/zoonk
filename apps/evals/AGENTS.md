<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
<!-- END:nextjs-agent-rules -->

# Evals

## Regression cases

- Every AI failure found while testing (persona walks, manual checks, eval runs, bug reports) becomes a test case on the task that produced it, in that task's `test-cases.ts`. The case uses the input that triggered the failure and states the expectation it broke. Add it with the fix, so the failure can't come back unnoticed and nobody has to check it by hand again.
- When code can verify the flaw, the task's scorer reuses the validator the generation pipeline runs before saving (for example `@zoonk/utils/text-flaws` or `findSkillGraphProblems`), so evals and production judge output the same way. Otherwise, write the expectation so the judge can check it.
- Cases hold Library content, public documents and test learners' inputs, never a real learner's data.
