# Eval lane A2: Muse Ember, 11 Nov 2026

All text runs are fresh against the current production generation functions, with four calls at a time per run. All scoring is deterministic; judge spend is $0. EN/PT cells show mean score out of 10 and number of scored cases; scores exclude refusals, which are reported separately. Classification-only accuracy can hide extraction errors. Latency is indicative on the shared machine; other lanes were active.

Models: Ember = meta/muse-ember; Luna = openai/gpt-6-luna; Lite = google/gemini-3.5-flash-lite; Haiku = anthropic/claude-haiku-5.5; Flash = google/gemini-3.8-flash. Prices include measured reasoning/cache use.

## course-intent

No change. Ember refuses 5/188 inputs, including 5/12 unsafe-label cases (2/2 English and 2/2 Portuguese explicit adversarial cases). The current default answers all and costs less.

| Model | Scored | EN /10 (n) | PT /10 (n) | p50 s | p95 s | $/1k | Failures/refusals |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ember | 183 | 9.97 (134) | 10.00 (27) | 1.25 | 2.74 | 0.4297 | 5 |
| Luna | 188 | 9.97 (137) | 10.00 (29) | 1.59 | 2.70 | 0.0543 | 0 |
| Lite | 188 | 9.85 (137) | 10.00 (29) | 1.02 | 1.22 | 0.7264 | 0 |
| Haiku | 188 | 9.82 (137) | 10.00 (29) | 1.25 | 2.07 | 0.0907 | 0 |

## goal-specificity

Replace Flash Lite with Ember as first fallback; retain cheaper Haiku default and Luna as second fallback. Ember passes every split on 21 cases, costs less and answers faster than Flash Lite, and adds Meta provider diversity. Haiku costs less but invents one occupation; no default switch under the lane rule requiring equal or lower cost.

| Model | Scored | EN /10 (n) | PT /10 (n) | p50 s | p95 s | $/1k | Failures/refusals |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ember | 21 | 10.00 (9) | 10.00 (7) | 0.91 | 1.15 | 0.1298 | 0 |
| Luna | 21 | 9.33 (9) | 10.00 (7) | 1.57 | 2.07 | 0.0798 | 0 |
| Lite | 21 | 9.56 (9) | 10.00 (7) | 5.33 | 7.28 | 2.4312 | 0 |
| Haiku | 21 | 9.78 (9) | 10.00 (7) | 1.63 | 2.10 | 0.0773 | 0 |

## understand-goal

No change. Ember refuses the hostile input, loses a native language and omits exam subjects from the Japanese title; its p95 is 7.41 s.

| Model | Scored | EN /10 (n) | PT /10 (n) | p50 s | p95 s | $/1k | Failures/refusals |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ember | 64 | 10.00 (24) | 9.95 (37) | 2.82 | 7.41 | 1.1629 | 1 |
| Luna | 65 | 10.00 (25) | 9.95 (37) | 4.05 | 5.57 | 0.2009 | 0 |
| Lite | 65 | 9.92 (25) | 9.89 (37) | 1.55 | 1.98 | 1.5160 | 0 |
| Haiku | 65 | 10.00 (25) | 9.22 (37) | 2.26 | 2.94 | 0.3670 | 0 |

## plan-edit-intent

No change. Ember adds an unrequested focus area; it is slower at the tail than the default (5.45 vs 1.69 s). The fresh default also misses the history-only focus case.

| Model | Scored | EN /10 (n) | PT /10 (n) | p50 s | p95 s | $/1k | Failures/refusals |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ember | 58 | 9.59 (22) | 10.00 (36) | 1.83 | 5.45 | 0.9136 | 0 |
| Luna | 58 | 9.18 (22) | 8.58 (36) | 3.00 | 8.10 | 0.1640 | 0 |
| Lite | 58 | 9.59 (22) | 9.75 (36) | 1.37 | 1.69 | 1.3363 | 0 |
| Haiku | 58 | 9.59 (22) | 9.33 (36) | 2.05 | 5.62 | 0.3298 | 0 |

## plan-routine-fit

No change. Six cases are too few for a new decision and Ember has a 13.41 s p95 versus 1.39 s for Flash Lite.

| Model | Scored | EN /10 (n) | PT /10 (n) | p50 s | p95 s | $/1k | Failures/refusals |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ember | 6 | 10.00 (3) | 10.00 (3) | 1.58 | 13.41 | 0.8745 | 0 |
| Luna | 6 | 10.00 (3) | 7.00 (3) | 2.17 | 3.11 | 0.1442 | 0 |
| Lite | 6 | 10.00 (3) | 10.00 (3) | 1.08 | 1.39 | 0.4293 | 0 |
| Haiku | 6 | 10.00 (3) | 10.00 (3) | 2.11 | 3.52 | 0.2569 | 0 |

## memory-search-terms

No change. Ember misses the Portuguese bakery fact and costs more with a slower tail; its 90% recall versus the default's 80% on ten cases does not establish a worthwhile improvement.

| Model | Scored | EN /10 (n) | PT /10 (n) | p50 s | p95 s | $/1k | Failures/refusals |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ember | 10 | 10.00 (5) | 9.40 (5) | 4.18 | 8.18 | 1.1371 | 0 |
| Luna | 10 | 9.40 (5) | 9.40 (5) | 3.49 | 4.41 | 0.1928 | 0 |
| Lite | 10 | 9.40 (5) | 9.40 (5) | 1.10 | 1.37 | 0.4055 | 0 |
| Haiku | 10 | 9.40 (5) | 9.40 (5) | 1.62 | 2.93 | 0.1128 | 0 |

## library-search-terms

No change. Ember and Luna both find the target on 12/16 cases; Ember costs more ($0.2393 vs $0.1049/1k).

| Model | Scored | EN /10 (n) | PT /10 (n) | p50 s | p95 s | $/1k | Failures/refusals |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ember | 16 | 8.86 (7) | 9.11 (9) | 0.94 | 1.43 | 0.2393 | 0 |
| Luna | 16 | 8.86 (7) | 9.11 (9) | 3.05 | 4.42 | 0.1049 | 0 |
| Lite | 16 | 9.43 (7) | 9.33 (9) | 6.16 | 9.30 | 3.6999 | 0 |
| Haiku | 16 | 8.86 (7) | 9.11 (9) | 1.56 | 2.95 | 0.1666 | 0 |

## icon-match

No change. Ember is fast and correct, but only four cases cover eleven individual icon needs; it costs more than Luna. More coverage is needed before a model decision.

| Model | Scored | EN /10 (n) | PT /10 (n) | p50 s | p95 s | $/1k | Failures/refusals |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ember | 4 | 10.00 (2) | 10.00 (2) | 0.80 | 1.13 | 0.1259 | 0 |
| Luna | 4 | 10.00 (2) | 10.00 (2) | 2.21 | 3.76 | 0.0771 | 0 |
| Lite | 4 | 9.33 (2) | 10.00 (2) | 5.40 | 8.58 | 2.9715 | 0 |
| Haiku | 4 | 10.00 (2) | 10.00 (2) | 1.77 | 2.55 | 0.1786 | 0 |

## upload-visibility

No change. All tried models get the eight labels right; Luna costs less and Flash Lite is faster and cheaper than Ember. Two English cases are insufficient evidence for changing privacy routing.

| Model | Scored | EN /10 (n) | PT /10 (n) | p50 s | p95 s | $/1k | Failures/refusals |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ember | 8 | 10.00 (2) | 10.00 (6) | 1.68 | 2.41 | 0.4688 | 0 |
| Luna | 8 | 10.00 (2) | 10.00 (6) | 2.12 | 3.94 | 0.1191 | 0 |
| Lite | 8 | 10.00 (2) | 10.00 (6) | 1.09 | 1.31 | 0.3120 | 0 |
| Haiku | 8 | 10.00 (2) | 10.00 (6) | 1.72 | 3.14 | 0.1580 | 0 |
| Flash | 8 | 10.00 (2) | 10.00 (6) | 3.63 | 4.65 | 1.3273 | 0 |

## Decision-only tasks

Memory gate uses Jev with Mammoth fallback. Memory relevance uses Decider V1.2 with Mammoth fallback. Picture need uses Jev with Elephant fallback. Their generate routes are aliases of decision adapters, rather than production generation routes. No Ember generation comparison or change was made.

## Blind read and regression evidence

Claude Opus 5.5, personal account, high effort, read every shuffled Ember/Flash Lite goal-specificity pair: Ember 3 wins, Flash Lite 0, ties 18. It confirmed Flash Lite misclassified the private codebase and noted smaller Korean context and Turkish level omissions; those smaller omissions are not fully checked by the keyword scorer. The primary GPT reader inspected all score disagreements against the incumbent defaults.

The scorer now rejects invented personal details when an input only names an audience (English and Portuguese nurse cases). The added regression tests fail against the original scorer and pass against the new one (2/2). Both affected cases were rescored for every stored model, including native decisions; no judge was called. Added three Portuguese course-intent regression counterparts: policy bypass, context exhaustion and Sony code execution. Existing failing inputs remain as regression cases; no prompts or expectations were weakened.

## Audio check

Converted data/speech/en-rent-correct.mp3 with ffmpeg to WebM/Opus and MP4/AAC. Both fail through transcribeSpeech with MAI, GatewayInternalServerError: Bad Request (1.284 s / 0.465 s). Codec probes, hashes and errors are in mai-formats.json. No full audio suite was needed; GPT transcription remains default. The throwaway script was deleted.

## Spend and verification

Saved text eval spend: $0.797120741; production-path smoke: $0.0001432; measured total $0.797263941. No judge calls. Two failed transcription calls expose no usage or charge, so their cost is unknown; the spend meter does not capture rejected transcription calls. Total remains far below the $10 cap under ordinary short-clip billing.

Ember production-path smoke uses classifyGoalSpecificity with useFallback=true, task reasoning defaults, prompt-cache and no-training middleware; returned privateCourse=true, null generalGoal, model/provider meta/muse-ember / meta. Meta needs no added provider order: the existing unknown-prefix path leaves order to Gateway. Prompt caching only marks supported OpenAI/Anthropic prefixes; Meta receives no incompatible marker.

Validation: oxfmt and oxlint on all touched source; AI tsc; evals tsc after next typegen; goal-specificity regression tests 2/2; AI provider-options and prompt-cache tests 21/21. Initial evals typecheck failed on missing generated LayoutProps/PageProps; next typegen generated them and final tsc passed. The first lint found missing blank lines in the new test, corrected before final checks. No servers started. Cross-model PR review remains with the lead; the lane brief authorizes only blind-read helpers.

## Remaining limits

Icon-match has four cases, upload-visibility eight, and routine-fit six. Library matching is a text matcher, not a deployed Postgres retrieval measurement; memory search uses an explicitly documented stemming approximation. The understand-goal classifier can report 100% route accuracy despite missing extraction fields. The fresh incumbents also fail existing cases (notably Luna in Portuguese routine-fit and plan edits, Flash Lite in narrow history focus, and the native-language extraction shared by multiple models); their complete saved failures remain available. The provider-usage helper reported zero-cost probe outputs rather than comparable remaining quotas; both allowed Claude accounts were eligible, and personal was used. No external issue or PR was opened.

Diff audit: no blocking findings. Repeated TEST_CASES constants are separate task datasets. The two goalCase helpers construct unrelated specificity versus tutor fixtures; neither is a shared product rule. noPersonalDetails belongs to the specificity scorer and its two audience-only cases; there is no competing implementation.
