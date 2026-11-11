# Lesson model evaluation, 11 Nov 2026

No model changes are supported by the completed comparisons. Prompts, the review design, judges and provider configuration are unchanged.

## Method and limits

Quality comes first for shared lessons and chapter challenges. All five tasks run through durable generation workflows; no interactive answer-grading path is changed. Learners can still wait when content is missing, especially the first lesson, so latency is reported even for prepared content. Runs overlapped other lanes on a shared machine and gateway; these are observed run latencies, not isolated provider benchmarks. Personal writing was not tested: Carbon cost $155.79/1k shared writer runs, versus the existing Terra personal evidence of $21/1k, and did not pass the shared quality screen.

The writer prompt changed after 8 Nov, so sampled Opus and Argon outputs were regenerated. Writer battle judgments were then rerun against the final output hashes. Fable and Carbon were fresh. Reviewer Astra's recorded-lesson outputs were reused only after verifying its prompt/generate change predates those outputs; its planted cases were regenerated. Spec, fix and challenge incumbents were scheduled fresh. All failures reported here occurred on existing regression inputs; no easier substitute cases or prompt tuning were used.

The first writer battle overlapped an incumbent refresh. It was superseded by c1-writer-final.log, whose four-model panel matches the final outputs. Both rounds' charges count toward spend. Reviewer commands overlapped on disjoint sampled cases; their output and result records were merged by case-run id, preserving all 18 unique cases. The substring filter real- also selects pt-regra-real-brand-failure; it is counted once in the union.

## Decisions

- lesson-writer: keep shared Opus, personal Terra and Argon outage fallback. Final battle Opus 8.63, Fable 8.53, Argon 7.97, Carbon 7.67. Fable cost 4.55 times Opus with no demonstrated gain. Carbon cost 4.14 times Argon and failed three code checks. Four cases suffice to reject switching, not to establish general equivalence.
- lesson-quality-check: keep Astra/Sol/Opus. On the original six confirmed error targets, Fable caught 2/6, Carbon 5/6 and Astra 6/6 (the real-1 ordering and summary errors count separately). Fable missed real-1, real-2 and real-3; Carbon missed real-2 and flagged the clean temperature lesson. Carbon improves on the prior Argon audit's zero confirmed catches but fails the no-false-flags requirement and still misses a confirmed error. The clean flag rejects “take the start away”: subtracting the negative starting temperature from the rise is exactly the incorrect operation producing 11 degrees, so the existing feedback is defensible.
- lesson-fix: keep the writer as its own fixer. All four models score 10 on six existing cases. Fable is more expensive than Opus; Carbon is more expensive and slower than Terra. This is not evidence to independently replace the writer-owned model.

- challenge-case: keep Sol, Terra and Argon. Carbon 7.61 (EN 7.83, PT 7.38) at $199/1k does not improve Argon 7.60 at $66/1k and trails Sol 8.74 at $50/1k. Carbon had one code-invalid graph and multiple judge-flagged factual errors. Its p95 was 505.97 seconds.

- lesson-spec: keep shared Sol with Terra and Opus fallbacks. Carbon EN 9.08/PT 8.00/ES 6.88 costs $268/1k versus Sol EN 9.62/PT 9.27/ES 8.73 at $82/1k. Carbon also failed existing code checks in the Spanish and enzyme cases and took up to 1,121.91 seconds.

## Blind reads

GPT-6.1 Sol read shuffled Fable/Opus and Carbon/Argon writer pairs. Fable wins 1, loses 2, ties 1. Carbon wins 3, loses 0, ties 1 on the qualitative read, which favored explicit explanations and discriminating distractors; the cross-family battle's broader weighted rubric and code checks favor Argon. This qualitative preference is not a demonstrated scorer defect: the battle applies weighted teaching, accuracy and level rubrics as well as code checks, rather than the narrower explanation/distractor preferences recorded by the reader. Neither result supports paying four times as much for Carbon, whose battle quality is below the floor in Portuguese.

Claude Opus 5.5 on claudeAgent_personal independently read all 18 shuffled reviewer pairs, each input and both outputs, without the key. Unblinded: Astra wins 4, Fable wins 1, ties 13. Both caught all eight planted errors and passed four clean controls. On recorded lessons the reader identified one borderline Astra sovereignty flag and an extra valid Fable Teresina catch. This does not erase Fable's three missed faulty lessons. Keys and itemized verdicts are saved beside this report. Provider usage was checked before delegation.

Claude Opus 5.5 on claudeAgent_personal then read all 16 shuffled Carbon/OpenAI pairs, checking challenge arithmetic and fixer changes against the input. Unblinded: Carbon wins 3/4 specs versus Sol; 5/6 challenges versus Sol; and 2/6 fixes versus Terra with 4 ties. Itemized verdicts and the key are saved here.

These preferences do not show that the automated scores are wrong. The reader knowingly preferred richer choices even when the preferred output had a factual defect. Its Carbon challenge wins include the unverified list-price revenue repair and the claim that a nonsignificant result proves the initial lead was luck, which it explicitly lists as defects. The existing accuracy rubric caps these errors, and the judge flagged them on the same original cases. The spec read favors Carbon's richer enzyme visuals despite noting that its scope expands from two input skills to four; the existing scope and code checks penalize that expansion and missed pacing rules. Conversely, the reader marks four consecutive teaching screens as a defect in the stability plan, but the code permits four (it rejects five). No factual or deterministic scorer error was demonstrated, so expectations and scorers were retained rather than changed to force subjective rankings to agree. All the concrete failures remain saved on the existing inputs that exercise them.

For fixes, the reader confirmed that all requested corrections were made. Its preferences concern the quality of rewritten distractors and unnecessary label edits, which the deterministic fixer score does not grade as an additional teaching-quality axis. Carbon's stronger distractors on one case do not establish a useful gain in the repair contract at 3.5 times Terra's cost. The report therefore preserves the blind preferences, the rubric scores and their different limits, without promoting a model on either alone.

## Eval limitations outside this lane's changes

The written reviewer scorer checks verdict and whether a flagged screen matches the expected screen. It cannot count all distinct confirmed errors, validate an issue's claim, or penalize extra false flags on an already-failing lesson. Reported classification accuracy is therefore separate from manual issue-level findings. Its real fixtures encode five faulty lessons plus one clean control, not six independent error checks. The historical Argon reviewer metrics are recorded in the model-selection comment but no standalone Argon reviewer output file is present in this checkout; this audit does not invent latency or cost for it.

The writer's current code checks reject beginner sentence length and em dashes, including nested activity text. Three checks failed for each Google model on this sample. These are existing cases and validators, not a new review design. Judge concerns on Carbon's challenge outputs include treating nonsignificance as proof of no effect, unsupported AI revenue repairs, and calling below-target positive profit a loss; the saved outputs remain on the original failing inputs.

## Results

Language counts: writer EN 2/PT 2; reviewer EN 5/PT 13; fixer EN 4/PT 2; challenge EN 3/PT 3; spec EN 1/PT 2/ES 1. Reviewer quality is verdict accuracy (%); other quality columns are 0–10. Generation failures and refusals are shown separately from code checks and manual false flags.

### lesson-writer

| Model | Cases | EN | PT | p50 s | p95 s | Cost / 1k | Generation failures / refusals |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| anthropic/claude-fable-5.2 | 4 | 8.45 | 8.6 | 102.24 | 200.38 | $704.29 | 0 / 0 |
| anthropic/claude-opus-5.5 | 4 | 8.91 | 8.35 | 40.54 | 54.23 | $154.75 | 0 / 0 |
| google/gemini-4-carbon | 4 | 7.95 | 7.39 | 123.96 | 240.88 | $155.79 | 0 / 0 |
| google/gemini-4-argon | 4 | 8.23 | 7.71 | 19.63 | 31.62 | $37.61 | 0 / 0 |

### lesson-quality-check

| Model | Cases | EN | PT | p50 s | p95 s | Cost / 1k | Generation failures / refusals |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| anthropic/claude-fable-5.2 | 18 | 100.0 | 76.92 | 10.94 | 25.57 | $105.62 | 0 / 0 |
| google/gemini-4-carbon | 18 | 80.0 | 92.31 | 42.63 | 128.32 | $62.37 | 0 / 0 |
| openai/gpt-6-astra | 18 | 100.0 | 100.0 | 5.62 | 19.79 | $65.66 | 0 / 0 |

### lesson-fix

| Model | Cases | EN | PT | p50 s | p95 s | Cost / 1k | Generation failures / refusals |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| anthropic/claude-fable-5.2 | 6 | 10.0 | 10.0 | 11.14 | 24.36 | $179.16 | 0 / 0 |
| google/gemini-4-carbon | 6 | 10.0 | 10.0 | 48.96 | 114.61 | $41.74 | 0 / 0 |
| anthropic/claude-opus-5.5 | 6 | 10.0 | 10.0 | 9.63 | 16.04 | $76.08 | 0 / 0 |
| openai/gpt-6.1-terra | 6 | 10.0 | 10.0 | 7.86 | 22.4 | $11.87 | 0 / 0 |

### lesson-spec

| Model | Cases | EN | PT | p50 s | p95 s | Cost / 1k | Generation failures / refusals |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| google/gemini-4-carbon | 4 | 9.08 | 8.0 | 267.35 | 1121.91 | $268.16 | 0 / 0 |
| openai/gpt-6.1-sol | 4 | 9.62 | 9.27 | 102.34 | 213.66 | $81.79 | 0 / 0 |
| openai/gpt-6.1-terra | 4 | 9.46 | 8.87 | 33.51 | 41.12 | $24.76 | 0 / 0 |
| anthropic/claude-opus-5.5 | 4 | 9.08 | 8.35 | 119.0 | 200.19 | $365.14 | 0 / 0 |

### challenge-case

| Model | Cases | EN | PT | p50 s | p95 s | Cost / 1k | Generation failures / refusals |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| google/gemini-4-carbon | 6 | 7.83 | 7.38 | 218.34 | 505.97 | $199.17 | 0 / 0 |
| google/gemini-4-argon | 6 | 7.76 | 7.44 | 72.35 | 77.4 | $65.81 | 0 / 0 |
| openai/gpt-6.1-sol | 6 | 8.82 | 8.67 | 86.25 | 99.1 | $50.31 | 0 / 0 |
| openai/gpt-6.1-terra | 6 | 8.45 | 8.37 | 48.7 | 55.45 | $22.89 | 0 / 0 |

## Verification

- AI package tsc --noEmit --incremental false: passed.
- Writer, fixer and reviewer-model unit tests: 3 files, 13 tests passed; lesson-spec: 1 file, 6 tests passed (19 total).
- Initial evals plain tsc: failed because Next route globals were absent in the fresh checkout. The prescribed pnpm --filter evals typecheck generated route types, then passed.
- Oxfmt and oxlint: passed for the five source files; generated eval data follows its existing formatter exclusions. All touched JSON parsed, and every final writer battle output hash matched its saved current output. git diff --check passed.
- Diff verifier: no questions on the branch diff.
- Source comments are the only production changes; model constants and behavior are unchanged. No app server, persona run or production AI generation was started, as the lane brief excludes them. No design debate was needed for retaining existing choices.

## Spend and case coverage

Total generation plus judge spend was **$23.72** (sum of CLI-rounded run totals), under the $40 cap. spend.json gives every charged command, including the superseded writer battle, duplicate real-brand attempts and the final rejudging. Subscription blind readers add no AI Gateway charges. No paid calls remain running.

No scorer, judge, prompt, test-case expectations or provider configuration changed. Every observed failure is already represented by its original existing input and expectation/code check, and its failed output is saved; no extra duplicate regression inputs were added. The original six confirmed reviewer errors remain distinct manual targets even though the deterministic scorer collapses them by screen/verdict.
