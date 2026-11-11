# Verification

Change: eval inputs, saved outputs, battle judgments, blind verdicts and the task writer/fallback configuration, with its unit contract assertion. No prompt, public API, native UI or database behavior changed. The production configuration is exercised by the mocked model-boundary unit test; live generation uses explicit model overrides, so this is not a live production-fallback exercise. No browser, server, device or screenshot work applies. No design debate or helper-agent review was run, as requested.

- `pnpm exec oxfmt` on touched files: passed on all three touched TypeScript files. The repository formatter configuration intentionally excludes `apps/evals/eval-results`; an explicit attempt also confirmed that exclusion, and generated evidence retains its normal JSON/Markdown serialization.
- `pnpm exec oxlint` on all three touched TypeScript files: passed after adding the required blank-line padding around the fallback list and model assertion.
- `pnpm --filter @zoonk/ai exec tsc --noEmit --incremental false`: passed.
- `pnpm --filter evals typecheck`: passed, including Next route type generation and `tsrs --noEmit`.
- `pnpm --filter @zoonk/ai test src/tasks/language/level-test-bank.test.ts`: 1 file, 2 tests passed.
- From `apps/evals`, `node --conditions=react-server --import tsx --import ./scripts/register-markdown.mts scripts/check-language-coverage.ts`: passed, all 100 tasks covered or documented skips. The bank task retains English and Portuguese coverage and adds French and Japanese learners.

The four new comparison cases run the real generation function and battle code checks. The additional price-localization and French workplace-ambiguity regressions and sharpened German clock/price regression have no saved outputs from any model, verified across all bank output files, so no existing score becomes stale. The other confirmed key failures already have dedicated regression cases with the same pair inputs.

The first `eval:run` attempt was blocked before model calls by the sandbox's denial of the tsx IPC socket (`listen EPERM`). The authorized run used host access. No charge or saved generation came from the blocked attempt. Logs and scratch scripts remain outside the repository.
