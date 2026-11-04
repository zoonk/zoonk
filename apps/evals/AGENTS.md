# Evals

## Regression cases

- Every AI failure found while testing (persona walks, manual checks, eval runs, bug reports) becomes a test case on the task that produced it, in that task's `test-cases.ts`, added with the fix. The case uses the input that triggered the failure and states the expectation it broke.
- When code can verify the flaw, the task's scorer reuses the validator the generation pipeline runs before saving (for example `@zoonk/utils/text-flaws` or `findSkillGraphProblems`), so evals and production judge output the same way. Otherwise, write the expectation so the judge can check it.
- Cases hold Library content, public documents and test learners' inputs, never a real learner's data.
