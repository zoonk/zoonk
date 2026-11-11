# Eval lane C2, 11 Nov 2026

Recommendation: retain every production model chain. No production model or provider option changed. The completed sample does not establish a replacement. Fable bank quality merits further investigation, but localization and ambiguous keys still prevent sign-off. Carbon adds substantial latency and measured cost. Ember is neither cheaper nor better than Luna on this task.

All generations used the real task functions through apps/evals. No server, private learner data, deployment, push or PR. The $30 cap includes metered generation and API judges; the Claude subscription blind read adds no API charge. New models were fresh; all compared incumbents in this report were freshly regenerated too. Calls from separate task processes overlapped, so timings describe this run, not controlled isolated latency; p95 of 4 cases is their maximum.

## Results

Scores are out of 10. EN/PT refer to learner language, not practiced language. A dash means the sample has no case in that language. Cost includes every metered task call, including sentence-order review; it excludes the separate eval judge. Failure/refusal counts below are for this lane, excluding retained historical failures. Item key counts are judge-flagged, not an independently verified count of every possible wrong key.

### coverage-check

| Model                       | Scored/generated | EN   | PT   | p50 s | p95 s | $/1k runs | Key flags | Failures/refusals |
| --------------------------- | ---------------- | ---- | ---- | ----- | ----- | --------- | --------- | ----------------- |
| anthropic/claude-sonnet-5.5 | 6/6              | 10.0 | 10.0 | 4.14  | 7.19  | 9.76      | n/a       | 0/0               |
| google/gemini-4-carbon      | 6/6              | 10.0 | 10.0 | 19.54 | 69.52 | 20.47     | n/a       | 0/0               |

### language-lesson

| Model                   | Scored/generated | EN  | PT   | p50 s | p95 s  | $/1k runs | Key flags | Failures/refusals |
| ----------------------- | ---------------- | --- | ---- | ----- | ------ | --------- | --------- | ----------------- |
| google/gemini-3.8-flash | 4/4              | 7.9 | 7.8  | 17.09 | 31.26  | 13.89     | n/a       | 0/0               |
| google/gemini-4-carbon  | 4/4              | 8.6 | 8.15 | 93.35 | 297.77 | 146.04    | n/a       | 0/0               |
| openai/gpt-6.1-terra    | 4/4              | 8.8 | 8.65 | 30.96 | 327.05 | 14.63     | n/a       | 0/0               |

### language-sentence-orders

| Model                  | Scored/generated | EN   | PT   | p50 s | p95 s | $/1k runs | Key flags | Failures/refusals |
| ---------------------- | ---------------- | ---- | ---- | ----- | ----- | --------- | --------- | ----------------- |
| google/gemini-4-argon  | 4/4              | 8.39 | 9.26 | 12.04 | 18.2  | 5.16      | n/a       | 0/0               |
| google/gemini-4-carbon | 4/4              | 8.31 | 8.72 | 16.4  | 29.73 | 11.16     | n/a       | 0/0               |

### level-test-bank

| Model                       | Scored/generated | EN   | PT   | p50 s  | p95 s  | $/1k runs | Key flags  | Failures/refusals |
| --------------------------- | ---------------- | ---- | ---- | ------ | ------ | --------- | ---------- | ----------------- |
| anthropic/claude-fable-5.2  | 4/4              | 8.7  | 9.18 | 131.07 | 231.01 | 2058.53   | see review | 0/0               |
| anthropic/claude-opus-5.5   | 4/4              | 8.4  | 7.12 | 79.15  | 95.95  | 645.82    | see review | 0/0               |
| anthropic/claude-sonnet-5.5 | 4/4              | 7.93 | 8.8  | 98.19  | 119.14 | 479.02    | see review | 0/0               |
| google/gemini-4-carbon      | 4/4              | 8.38 | 8.38 | 206.87 | 437.22 | 562.45    | see review | 0/0               |

### skill-levels

| Model                  | Scored/generated | EN   | PT   | p50 s | p95 s | $/1k runs | Key flags | Failures/refusals |
| ---------------------- | ---------------- | ---- | ---- | ----- | ----- | --------- | --------- | ----------------- |
| google/gemini-4-argon  | 5/5              | 9.9  | 9.9  | 10.78 | 37.42 | 7.91      | n/a       | 0/0               |
| google/gemini-4-carbon | 5/5              | 9.9  | 10.0 | 63.84 | 152.9 | 69.47     | n/a       | 0/0               |
| meta/muse-ember        | 5/5              | 9.49 | 9.95 | 29.18 | 68.08 | 9.19      | n/a       | 0/0               |
| openai/gpt-6-luna      | 5/5              | 9.81 | 9.84 | 9.75  | 16.13 | 0.78      | n/a       | 0/0               |

### solve-items

| Model                       | Scored/generated | EN   | PT   | p50 s | p95 s  | $/1k runs | Key flags | Failures/refusals |
| --------------------------- | ---------------- | ---- | ---- | ----- | ------ | --------- | --------- | ----------------- |
| anthropic/claude-sonnet-5.5 | 13/13            | 10.0 | 10.0 | 4.36  | 18.65  | 8.54      | n/a       | 0/0               |
| google/gemini-4-carbon      | 12/12            | 10.0 | 9.33 | 34.6  | 503.95 | 49.81     | n/a       | 1/0               |
| openai/gpt-6-luna:high      | 13/13            | 10.0 | 9.43 | 5.02  | 11.2   | 0.33      | n/a       | 0/0               |

### statute-drills

| Model                       | Scored/generated | EN   | PT   | p50 s | p95 s  | $/1k runs | Key flags | Failures/refusals |
| --------------------------- | ---------------- | ---- | ---- | ----- | ------ | --------- | --------- | ----------------- |
| anthropic/claude-sonnet-5.5 | 4/4              | 8.37 | 9.31 | 19.15 | 20.1   | 34.12     | 1         | 0/0               |
| google/gemini-4-carbon      | 4/4              | 7.92 | 9.65 | 43.7  | 227.28 | 74.12     | 0         | 0/0               |

### word-ipa

| Model                       | Scored/generated | EN  | PT  | p50 s | p95 s | $/1k runs | Key flags | Failures/refusals |
| --------------------------- | ---------------- | --- | --- | ----- | ----- | --------- | --------- | ----------------- |
| anthropic/claude-sonnet-5.5 | 6/6              | —   | —   | 2.27  | 2.55  | 1.64      | n/a       | 0/0               |
| google/gemini-4-carbon      | 6/6              | —   | —   | 8.27  | 11.43 | 3.85      | n/a       | 0/0               |

### write-item-set

| Model                      | Scored/generated | EN   | PT   | p50 s | p95 s  | $/1k runs | Key flags | Failures/refusals |
| -------------------------- | ---------------- | ---- | ---- | ----- | ------ | --------- | --------- | ----------------- |
| anthropic/claude-fable-5.2 | 4/4              | 10.0 | 8.92 | 85.54 | 120.38 | 360.65    | 0         | 0/0               |
| google/gemini-4-carbon     | 4/4              | 9.62 | 8.56 | 67.68 | 502.76 | 97.76     | 0         | 0/0               |
| openai/gpt-6.1-terra       | 4/4              | 8.69 | 8.54 | 24.97 | 37.56  | 12.93     | 0         | 0/0               |

### write-listening-set

| Model                      | Scored/generated | EN   | PT   | p50 s | p95 s  | $/1k runs | Key flags | Failures/refusals |
| -------------------------- | ---------------- | ---- | ---- | ----- | ------ | --------- | --------- | ----------------- |
| anthropic/claude-fable-5.2 | 4/4              | 8.88 | 9.6  | 67.06 | 123.38 | 375.23    | 0         | 0/0               |
| anthropic/claude-opus-5.5  | 4/4              | 8.92 | 8.96 | 43.68 | 88.63  | 137.98    | 1         | 0/0               |
| google/gemini-4-carbon     | 4/4              | 8.87 | 9.37 | 91.82 | 142.37 | 84.03     | 0         | 0/0               |
| openai/gpt-6.1-terra       | 4/4              | 9.04 | 9.35 | 30.9  | 61.98  | 17.48     | 0         | 0/0               |

## Decisions and key review

- **level-test-bank:** no switch. All four writers passed 44/44 structural groups. Battle averages: Fable 8.89, Opus 8.43, Sonnet 8.03, Carbon 7.76. Within the same Astra judge, Fable beat Opus 3/0/1; Argon also preferred Fable 3/0/1. These are judge wins, not a completed human blind read. Fable costs $2,058.53/1k versus Opus $645.82 and has a German afternoon departure keyed as 3:15 rather than 15:15. Opus has one C1 restaurant question with two defensible answers (`pt-en-1`). Carbon has a C1 ambiguity (`es-en-1`) and one unusable A1 distractor set containing English JSON self-instructions in Spanish options. Sonnet has an unsupported restaurant inference flagged in `es-en-1`; no independently confirmed wrong index count. These remain quality failures even when the structural checks pass. No full manual blind bank verdict is claimed.
- **write-item-set:** retain Terra/Opus. Fable and Carbon score higher on four cases with zero judge-flagged key flaws, but cost about 28x and 7.6x Terra. The sample and missing independent blind writer comparison cannot establish a quality gain worth switching. The batch stopped intentionally after Terra was scored, before Opus, generate-items or placement-items began. Exit 130 is a budget stop, not a provider refusal.
- **generate-items and placement-items:** not reached within the lane budget. No model recommendation beyond retaining current configuration pending evidence. Initial battle-mode attempts were rejected before any calls because these tasks do not expose codeChecks to battle mode.
- **solve-items:** retain the current chain; Carbon is not a replacement. Carbon completed 12/13 cases, caught 4/5 available wrong keys and kept 46/46 right items; one provider timeout prevented the sixth known-wrong key and four right items from being checked. Sonnet completed 13/13, caught 6/6 wrong keys and kept 50/50 right items. Luna at high completed 13/13, caught 5/6 wrong keys and kept 50/50 right items. Carbon and Luna both missed Article 5 item 3 in the retained `pt-cebraspe-cf88-art5-drills` case. This is a fresh regression against the older model comment, not grounds to silently promote Sonnet without the required independent blind read. Carbon p95 was 503.95 s for successful calls, excluding the failed request: after three attempts its final HTTP/2 headers timeout was 300000 ms. The failed run reported no usage/calls, so any provider charge missing from that timeout cannot be reconstructed. No content-policy refusals were recorded.
- **statute-drills:** retain Sonnet fallback. Carbon has no key flags but its EN mean is below 8 and it costs more with 227 s p95. Sonnet has one factual explanation flag on the GDPR exception, not a wrong keyed answer: substituting “high risk” broadens the exception, whereas its distractor explanation says the opposite. Zero confirmed wrong keys for each model in these four cases.
- **write-listening-set:** retain Terra/Opus. Fable has no key flags but costs about 21x Terra; Carbon costs about 4.8x Terra. Opus has one invalid accepted alternative: after “Hannah first saw a ________”, accepting “a poster” yields “a a poster”. The other accepted answer, “poster”, is correct. No independent writer-pair blind read was completed, so this is not evidence to replace the fallback.
- **language-lesson:** retain Terra/Flash pending broader review. Carbon improves some scores over Flash but costs over ten times as much, takes 298 s p95, and its Spanish-learner case scores 6.7. This sample is insufficient to validate new fallback quality.
- **language-sentence-orders:** retain Argon fallback. Carbon scores lower and costs more. Both results include the production reviewer (`checkOrderCandidates`), so this is a pipeline evaluation. Carbon kept a shifted “tomorrow” condition that the judge rejected in `en-pt-clause-order-1`. **check-sentence-orders** has no standalone registered eval here; it was not independently replaced or benchmarked.
- **skill-levels:** retain Luna/Argon. Ember has 6 labeled misses, Carbon 1, Luna 4 and Argon 3 across 102 labels; the blind read does not support switching. Ember spent heavily on reasoning, so its token list price did not translate to cheaper runs. The real classifySkillLevels task accepted the Meta prefix and generated all five cases, so no provider-order or model-family patch was needed.
- **word-ipa:** retain Sonnet. Carbon and Sonnet both pass the six sampled look-alikes, Carbon is slower and costs more. This is only German/Dutch look-alike coverage, with no EN/PT learner-language sample; it cannot establish full multilingual IPA equivalence.
- **coverage-check:** retain Sonnet. Both pass all six cases, Carbon costs more and is far slower.
- **curriculum-scope.ts:** no change. Its Opus fallback belongs to private lesson-spec generation (`getLessonSpecModels`), not these shared item/language tasks. This lane provides no lesson-spec comparison and therefore no evidence to replace it.

## Blind read

Claude Opus 5.5, high effort, personal account read all 15 anonymous skill pairs before unblinding. Pair order was independently shuffled with seed 98311. The key was stored outside the checkout until the read completed. Luna vs Ember: 2 wins, 1 loss, 2 ties. Luna vs Carbon: 3 wins, 2 losses. Argon vs Carbon: 2 wins, 2 losses, 1 tie. Only 61 of 492 paired placements differ; many margins are thin. The reader disputed some gold labels and used remembered CEFR descriptors without external validation. Those disagreements remain unresolved; no labels were silently changed and no promotion rests on the reported score advantage. See `skill-blind-verdicts.json`, `skill-blind-pairs.json` and `skill-blind-key.json`. Other writer comparisons involving OpenAI were not manually read by this GPT lane; no switch was made from those scores.

## Regression coverage and limits

Added four bank cases for the exact DE/ES localization/contamination inputs and EN/PT single-supported-answer contract, plus EN/PT Cambridge accepted-article cases. These are new case IDs, so no saved scores were invalidated or selectively rescored. They load and typecheck, but were not given new paid generations under the remaining cap. Existing GDPR and sentence-order cases retain the outputs and judge explanations exposing their failures. Broader lesson-score issues and CEFR label disputes remain leads for the owner, not validated production bug claims. No prompt tuning or scorer/judge changes.

The solved-key default has a fresh miss requiring owner review. The separate checker eval is absent, item battle mode is unavailable, the bank battle report lacks a structured wrong-key locator list, and the IPA sample is narrow. No production model change was attempted on that incomplete evidence.

## Verification

- `pnpm exec oxfmt` and `pnpm exec oxlint` on the two changed case files: passed.
- `pnpm --filter evals exec next typegen`: passed.
- `pnpm --filter evals exec tsc --noEmit --incremental false`: passed after route type generation; the first attempt failed only on absent `LayoutProps` and `PageProps`.
- `pnpm --filter evals eval:languages`: passed, all 100 tasks.
- `node scripts/verify/diff.mts --base HEAD`: only the nonblocking repeated `TEST_CASES` name across task modules. These arrays hold intentionally different task contracts, not competing implementations of one rule. No must-fix findings.
- No AI-package source changed, so no AI-package model assertions or unit tests changed or needed a run. No running-product walkthrough: the brief explicitly limits paid generations to apps/evals. No servers started. Design debate was skipped because this was model evaluation with no architecture or production behavior change. Generated eval-results are excluded by oxfmt configuration; an attempt to format only those returned “All matched files may have been excluded by ignore rules.” Their JSON was parsed separately.

The observed metered total is **$28.1073**: approximately **$21.888 generation** and **$6.219 API judging** (component sums rounded). The provider timeout supplied no billing usage; unreported charges, if any, are outside this recorded total.

This is a bounded audit, not a complete evaluation of every incumbent fallback chain. generate-items and placement-items were not reached, and the six new regression cases have no new paid run yet.

## Spend ledger

Incremental cost is calculated from newly written/changed output runs, billed failed calls and judge usage, compared with HEAD. Gateway charges marked as covering usage replace token estimates. Retained historical output rows are excluded.

```text
apps/evals/eval-results/outputs/coverage-check/google-gemini-4-carbon.json 0.1228
apps/evals/eval-results/outputs/language-lesson/google-gemini-4-carbon.json 0.5841
apps/evals/eval-results/outputs/language-sentence-orders/google-gemini-4-argon.json 0.0206
apps/evals/eval-results/outputs/language-sentence-orders/google-gemini-4-carbon.json 0.0446
apps/evals/eval-results/outputs/level-test-bank/anthropic-claude-fable-5.2.json 8.2341
apps/evals/eval-results/outputs/level-test-bank/google-gemini-4-carbon.json 2.2498
apps/evals/eval-results/outputs/skill-levels/google-gemini-4-carbon.json 0.3473
apps/evals/eval-results/outputs/skill-levels/meta-muse-ember.json 0.046
apps/evals/eval-results/outputs/solve-items/google-gemini-4-carbon.json 0.5977
apps/evals/eval-results/outputs/statute-drills/google-gemini-4-carbon.json 0.2965
apps/evals/eval-results/outputs/word-ipa/google-gemini-4-carbon.json 0.0231
apps/evals/eval-results/outputs/write-item-set/anthropic-claude-fable-5.2.json 1.4426
apps/evals/eval-results/outputs/write-item-set/google-gemini-4-carbon.json 0.3911
apps/evals/eval-results/outputs/write-listening-set/anthropic-claude-fable-5.2.json 1.5009
apps/evals/eval-results/outputs/write-listening-set/google-gemini-4-carbon.json 0.3361
apps/evals/eval-results/results/language-lesson/google-gemini-4-carbon.json 0.3627
apps/evals/eval-results/results/language-sentence-orders/google-gemini-4-argon.json 0.1979
apps/evals/eval-results/results/language-sentence-orders/google-gemini-4-carbon.json 0.1886
apps/evals/eval-results/results/statute-drills/google-gemini-4-carbon.json 0.3228
apps/evals/eval-results/results/write-item-set/anthropic-claude-fable-5.2.json 0.3069
apps/evals/eval-results/results/write-item-set/google-gemini-4-carbon.json 0.3284
apps/evals/eval-results/results/write-listening-set/anthropic-claude-fable-5.2.json 0.3383
apps/evals/eval-results/results/write-listening-set/google-gemini-4-carbon.json 0.3151
apps/evals/eval-results/battles/level-test-bank/de-en-1.json 0.4622
apps/evals/eval-results/battles/level-test-bank/en-pt-1.json 0.4631
apps/evals/eval-results/battles/level-test-bank/es-en-1.json 0.4475
apps/evals/eval-results/battles/level-test-bank/pt-en-1.json 0.436
apps/evals/eval-results/outputs/coverage-check/anthropic-claude-sonnet-5.5.json 0.0586
apps/evals/eval-results/outputs/language-lesson/google-gemini-3.8-flash.json 0.0556
apps/evals/eval-results/outputs/language-lesson/openai-gpt-6.1-terra.json 0.0585
apps/evals/eval-results/outputs/level-test-bank/anthropic-claude-opus-5.5.json 2.5833
apps/evals/eval-results/outputs/level-test-bank/anthropic-claude-sonnet-5.5.json 1.9161
apps/evals/eval-results/outputs/skill-levels/google-gemini-4-argon.json 0.0396
apps/evals/eval-results/outputs/skill-levels/openai-gpt-6-luna.json 0.0039
apps/evals/eval-results/outputs/solve-items/anthropic-claude-sonnet-5.5.json 0.111
apps/evals/eval-results/outputs/solve-items/openai-gpt-6-luna:high.json 0.0043
apps/evals/eval-results/outputs/statute-drills/anthropic-claude-sonnet-5.5.json 0.1365
apps/evals/eval-results/outputs/word-ipa/anthropic-claude-sonnet-5.5.json 0.0099
apps/evals/eval-results/outputs/write-item-set/openai-gpt-6.1-terra.json 0.0517
apps/evals/eval-results/outputs/write-listening-set/anthropic-claude-opus-5.5.json 0.5519
apps/evals/eval-results/outputs/write-listening-set/openai-gpt-6.1-terra.json 0.0699
apps/evals/eval-results/results/language-lesson/google-gemini-3.8-flash.json 0.3646
apps/evals/eval-results/results/language-lesson/openai-gpt-6.1-terra.json 0.3716
apps/evals/eval-results/results/statute-drills/anthropic-claude-sonnet-5.5.json 0.3793
apps/evals/eval-results/results/write-item-set/openai-gpt-6.1-terra.json 0.3189
apps/evals/eval-results/results/write-listening-set/anthropic-claude-opus-5.5.json 0.3259
apps/evals/eval-results/results/write-listening-set/openai-gpt-6.1-terra.json 0.2897
TOTAL 28.1073
```

Blind reader: [Blind-read CEFR skill placements](t3-thread://v2/6becb9e5-d1ae-4955-8c92-dc650fd4b9ae/thread:delegated-task:command%3Amcp%3A74e33197-9a57-41e3-ba8f-01a7988411db%3Adelegate-task%3Ac2-skill-blind-20261111).
