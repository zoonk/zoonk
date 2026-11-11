# B2 Muse Ember eval audit

New generations ran on 11 Nov 2026. Fresh comparisons are restricted to the same Ember case IDs; rows can additionally contain saved incumbent outputs with unchanged prompts, as noted below. Latencies measured on a shared machine with concurrent eval pipelines, so are indicative. EN/PT scores are out of 10.

## changing-facts

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 6/6 | 10.00 (2) | 10.00 (2) | 1.61 | 2.11 | 0.120 | 0 | 0.0007 |
| google/gemini-3.5-flash-lite | 6/6 | 10.00 (2) | 10.00 (2) | 0.94 | 1.33 | 0.255 | 0 | 0.0015 |
| meta/muse-ember | 6/6 | 10.00 (2) | 10.00 (2) | 1.36 | 1.85 | 0.328 | 0 | 0.0020 |
| openai/gpt-6-luna | 6/6 | 10.00 (2) | 10.00 (2) | 1.59 | 5.89 | 0.096 | 0 | 0.0006 |

## check-cited-facts

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 6/6 | 9.83 (2) | 9.66 (4) | 3.15 | 4.72 | 0.430 | 0 | 0.0026 |
| google/gemini-3.8-flash | 6/6 | 9.83 (2) | 10.00 (4) | 9.97 | 18.46 | 6.206 | 0 | 0.0372 |
| meta/muse-ember | 6/6 | 10.00 (2) | 10.00 (4) | 1.88 | 21.59 | 1.683 | 0 | 0.0101 |
| openai/gpt-6-luna | 6/6 | 9.17 (2) | 9.51 (4) | 4.23 | 12.12 | 0.338 | 0 | 0.0020 |

## check-exam-reading

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 5/5 | 10.00 (1) | 9.00 (4) | 7.63 | 9.56 | 4.296 | 0 | 0.0215 |
| google/gemini-3.8-flash | 5/5 | 10.00 (1) | 9.00 (4) | 12.40 | 55.97 | 30.805 | 0 | 0.1540 |
| meta/muse-ember | 5/5 | 10.00 (1) | 10.00 (4) | 11.42 | 14.48 | 3.750 | 0 | 0.0188 |
| openai/gpt-6-luna | 5/5 | 10.00 (1) | 10.00 (4) | 7.21 | 16.71 | 2.608 | 0 | 0.0130 |

## compare-release-lessons

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 6/6 | 10.00 (5) | 10.00 (1) | 6.04 | 8.19 | 0.752 | 0 | 0.0045 |
| google/gemini-3.5-flash-lite | 6/6 | 9.84 (5) | 10.00 (1) | 1.52 | 1.87 | 0.878 | 0 | 0.0053 |
| meta/muse-ember | 6/6 | 10.00 (5) | 10.00 (1) | 5.28 | 11.30 | 1.840 | 0 | 0.0110 |
| openai/gpt-6-luna | 6/6 | 10.00 (5) | 10.00 (1) | 8.23 | 11.79 | 0.466 | 0 | 0.0028 |

## extract-exam-blueprint

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| google/gemini-3.8-flash | 0/6 | — | — | — | — | — | 0 | 0.0000 |
| meta/muse-ember | 5/6 | — | 9.68 (5) | 94.57 | 152.95 | 30.568 | 1 | 0.5963 |
| openai/gpt-6-luna | 5/6 | — | 9.02 (5) | 147.79 | 174.65 | 19.667 | 1 | 0.5770 |

## extract-question-formats

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 9/9 | 9.10 (5) | 9.20 (4) | 5.05 | 17.76 | 28.919 | 0 | 0.2603 |
| google/gemini-3.5-flash-lite | 7/9 | 9.21 (5) | 8.40 (2) | 2.59 | 12.02 | 3.908 | 0 | 0.0274 |
| google/gemini-3.8-flash | 9/9 | 9.71 (5) | 10.00 (4) | 4.15 | 48.99 | 12.524 | 0 | 0.1127 |
| google/gemini-3.8-flash:low | 9/9 | 9.88 (5) | 10.00 (4) | 3.57 | 19.57 | 12.384 | 0 | 0.1115 |
| meta/muse-ember | 9/9 | 9.56 (5) | 10.00 (4) | 1.89 | 22.01 | 3.581 | 0 | 0.0322 |
| openai/gpt-6-luna | 9/9 | 9.68 (5) | 10.00 (4) | 7.75 | 24.21 | 4.705 | 0 | 0.0423 |
| openai/gpt-6.1-sol | 6/9 | 10.00 (4) | 10.00 (2) | 3.51 | 24.69 | 65.004 | 0 | 0.3900 |

## find-choice-options

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 4/4 | 10.00 (2) | 10.00 (2) | 6.82 | 7.83 | 6.086 | 0 | 0.0243 |
| google/gemini-3.8-flash | 4/4 | 10.00 (2) | 10.00 (2) | 6.28 | 12.27 | 10.084 | 0 | 0.0403 |
| meta/muse-ember | 4/4 | 10.00 (2) | 10.00 (2) | 4.48 | 6.62 | 7.288 | 0 | 0.0292 |
| openai/gpt-6-luna | 4/4 | 10.00 (2) | 7.00 (2) | 6.25 | 6.25 | 5.477 | 0 | 0.0219 |

## find-course-weights

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 4/4 | 9.00 (2) | 10.00 (2) | 9.24 | 10.63 | 6.376 | 0 | 0.0255 |
| google/gemini-3.8-flash | 4/4 | 9.00 (2) | 10.00 (2) | 8.09 | 23.56 | 17.667 | 0 | 0.0707 |
| meta/muse-ember | 4/4 | 10.00 (2) | 10.00 (2) | 4.41 | 9.28 | 7.382 | 0 | 0.0295 |
| openai/gpt-6-luna | 4/4 | 10.00 (2) | 10.00 (2) | 6.95 | 8.94 | 5.538 | 0 | 0.0222 |

## find-exam-date

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 4/4 | — | 10.00 (4) | 8.73 | 10.84 | 6.305 | 0 | 0.0252 |
| google/gemini-3.8-flash | 4/4 | — | 10.00 (4) | 7.52 | 8.27 | 10.799 | 0 | 0.0432 |
| meta/muse-ember | 4/4 | — | 10.00 (4) | 5.03 | 10.43 | 8.938 | 0 | 0.0358 |
| openai/gpt-6-luna | 4/4 | — | 8.50 (4) | 7.34 | 10.66 | 5.528 | 0 | 0.0221 |

## find-official-sources

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 4/4 | — | 10.00 (4) | 20.08 | 22.10 | 16.478 | 0 | 0.0659 |
| google/gemini-3.8-flash | 4/4 | — | 10.00 (4) | 15.63 | 22.69 | 20.851 | 0 | 0.0834 |
| meta/muse-ember | 0/4 | — | — | — | — | — | 4 | 0.0870 |
| openai/gpt-6-luna | 4/4 | — | 10.00 (4) | 38.86 | 55.83 | 21.554 | 0 | 0.0862 |

## find-product-pages

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 4/4 | 9.40 (3) | 10.00 (1) | 12.67 | 15.91 | 12.265 | 0 | 0.0491 |
| google/gemini-3.8-flash | 4/4 | 10.00 (3) | 10.00 (1) | 11.19 | 15.06 | 18.269 | 0 | 0.0731 |
| meta/muse-ember | 0/4 | — | — | — | — | — | 4 | 0.0707 |
| openai/gpt-6-luna | 4/4 | 10.00 (3) | 10.00 (1) | 16.90 | 21.46 | 15.823 | 0 | 0.0633 |

## find-subject-questions

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 4/4 | — | 9.00 (4) | 8.72 | 10.07 | 6.438 | 0 | 0.0258 |
| google/gemini-3.8-flash | 4/4 | — | 9.50 (4) | 11.94 | 18.53 | 19.873 | 0 | 0.0795 |
| meta/muse-ember | 4/4 | — | 9.50 (4) | 14.01 | 26.92 | 25.406 | 0 | 0.1016 |
| openai/gpt-6-luna | 4/4 | — | 9.50 (4) | 6.12 | 13.22 | 8.428 | 0 | 0.0337 |

## find-target-cutoff

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 4/4 | — | 9.00 (4) | 9.05 | 10.44 | 6.313 | 0 | 0.0253 |
| google/gemini-3.8-flash | 4/4 | — | 10.00 (4) | 6.83 | 9.01 | 10.703 | 0 | 0.0428 |
| meta/muse-ember | 4/4 | — | 9.00 (4) | 7.57 | 20.16 | 13.222 | 0 | 0.0529 |
| openai/gpt-6-luna | 4/4 | — | 10.00 (4) | 6.64 | 18.13 | 8.492 | 0 | 0.0340 |

## find-topic-frequency

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 4/4 | — | 9.50 (4) | 16.04 | 76.20 | 22.708 | 0 | 0.0908 |
| google/gemini-3.8-flash | 4/4 | — | 9.50 (4) | 13.60 | 27.07 | 27.275 | 0 | 0.1091 |
| meta/muse-ember | 2/4 | — | 10.00 (2) | 9.43 | 31.85 | 29.995 | 2 | 0.0600 |
| openai/gpt-6-luna | 4/4 | — | 9.50 (4) | 6.46 | 16.47 | 8.560 | 0 | 0.0342 |

## image-input-safety-rewrite

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 4/4 | 9.89 (3) | 9.83 (1) | 2.34 | 3.80 | 0.288 | 0 | 0.0960 |
| deepseek/deepseek-v4-flash | 4/4 | 8.33 (3) | 10.00 (1) | 7.43 | 25.68 | 1.110 | 0 | 0.1206 |
| google/gemini-3.5-flash-lite | 4/4 | 9.89 (3) | 9.50 (1) | 1.19 | 1.36 | 0.343 | 0 | 0.1065 |
| meta/muse-ember | 4/4 | 9.89 (3) | 10.00 (1) | 2.18 | 2.75 | 0.498 | 0 | 0.0965 |
| openai/gpt-6-luna | 4/4 | 9.61 (3) | 9.83 (1) | 2.97 | 8.24 | 0.156 | 0 | 0.1082 |

## image-scene

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 8/18 | 9.27 (2) | 9.41 (6) | 4.06 | 5.40 | 0.529 | 0 | 0.3466 |
| google/gemini-3.8-flash | 18/18 | 9.58 (7) | 9.60 (11) | 6.45 | 10.33 | 3.341 | 0 | 0.7773 |
| meta/muse-ember | 18/18 | 9.66 (7) | 9.59 (11) | 3.91 | 6.26 | 1.169 | 0 | 0.7088 |
| openai/gpt-6-luna | 16/18 | 9.40 (7) | 8.98 (9) | 6.11 | 11.34 | 0.291 | 0 | 0.6726 |

## past-questions

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 5/5 | 8.13 (2) | 8.84 (3) | 16.46 | 97.31 | 5.108 | 0 | 0.6693 |
| google/gemini-3.5-flash-lite | 5/5 | 7.18 (2) | 7.55 (3) | 4.33 | 21.68 | 10.290 | 0 | 0.7535 |
| meta/muse-ember | 5/5 | 9.02 (2) | 8.93 (3) | 10.03 | 52.58 | 6.137 | 0 | 0.7005 |
| openai/gpt-6-luna | 5/5 | 8.92 (2) | 8.14 (3) | 21.04 | 85.77 | 2.055 | 0 | 0.6493 |

## read-product-pages

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 6/6 | 10.00 (2) | 8.67 (4) | 18.60 | 26.13 | 4.394 | 0 | 0.0264 |
| google/gemini-3.5-flash-lite | 6/6 | 8.40 (2) | 8.42 (4) | 17.65 | 25.25 | 22.120 | 0 | 0.1327 |
| meta/muse-ember | 6/6 | 10.00 (2) | 9.50 (4) | 5.55 | 6.49 | 2.662 | 0 | 0.0160 |
| openai/gpt-6-luna | 6/6 | 10.00 (2) | 9.26 (4) | 40.03 | 49.23 | 3.453 | 0 | 0.0207 |

## research-plan

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 6/6 | 9.20 (1) | 9.87 (5) | 3.18 | 6.38 | 0.437 | 0 | 0.0026 |
| google/gemini-3.5-flash-lite | 6/6 | 10.00 (1) | 9.87 (5) | 1.42 | 1.71 | 0.759 | 0 | 0.0046 |
| meta/muse-ember | 6/6 | 10.00 (1) | 9.87 (5) | 5.36 | 6.83 | 1.422 | 0 | 0.0085 |
| openai/gpt-6-luna | 6/6 | 10.00 (1) | 10.00 (5) | 5.96 | 9.39 | 0.365 | 0 | 0.0022 |

## source-change-notice

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 4/4 | 10.00 (1) | 9.67 (2) | 2.12 | 2.44 | 0.144 | 0 | 0.0867 |
| google/gemini-3.5-flash-lite | 4/4 | 10.00 (1) | 9.58 (2) | 1.06 | 1.10 | 0.221 | 0 | 0.0924 |
| meta/muse-ember | 4/4 | 8.00 (1) | 9.67 (2) | 1.94 | 2.11 | 0.578 | 0 | 0.0939 |
| openai/gpt-6-luna | 4/4 | 9.17 (1) | 9.58 (2) | 2.59 | 3.64 | 0.116 | 0 | 0.0849 |

## source-research-plan

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 6/6 | 10.00 (4) | 9.50 (2) | 2.63 | 5.38 | 0.356 | 0 | 0.0021 |
| google/gemini-3.5-flash-lite | 6/6 | 10.00 (4) | 10.00 (2) | 1.29 | 1.44 | 0.684 | 0 | 0.0041 |
| meta/muse-ember | 6/6 | 10.00 (4) | 9.50 (2) | 3.16 | 6.90 | 1.126 | 0 | 0.0068 |
| openai/gpt-6-luna | 6/6 | 10.00 (4) | 10.00 (2) | 5.29 | 8.87 | 0.336 | 0 | 0.0020 |

## translate-pass-marks

| Model | Scored | EN | PT | p50 s | p95 s | $/1k | Failures | Spent incl judge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-haiku-5.5 | 3/3 | 9.67 (1) | 9.83 (1) | 8.62 | 9.24 | 1.037 | 0 | 0.0932 |
| google/gemini-3.5-flash-lite | 3/3 | 9.67 (1) | 9.33 (1) | 2.35 | 2.35 | 1.692 | 0 | 0.1103 |
| meta/muse-ember | 3/3 | 9.50 (1) | 7.67 (1) | 8.29 | 8.77 | 2.145 | 0 | 0.1060 |
| openai/gpt-6-luna | 3/3 | 10.00 (1) | 9.33 (1) | 5.47 | 5.47 | 0.370 | 0 | 0.0869 |

Recorded incremental generation, extra validation and judge cost (spend.json): $13.5884

## Decisions

| Task | Decision and reason |
| --- | --- |
| image-scene | New default Muse Ember; keep Gemini 3.8 Flash and Luna as fallbacks. Across all 18 cases Ember scored 9.62 versus Flash 9.60, at $1.17 versus $3.34 per 1k. Claude blind reads split 6 wins each and 6 ties. The eight fresh paired cases also agreed closely; ten incumbent outputs were reused only after verifying the image prompt's last change (6 Nov) predates their saved generation (8 Nov). These scenes are shared Library content. No provider-order or prompt-cache change is needed: Meta uses gateway routing without a forced order and no provider-specific cache breakpoint. The eval invokes the actual generateImageScene function with Meta, structured output, normalization, provenance and production middleware. |
| past-questions | No change. Ember had higher quality in this sample and won the blind comparison 3/1/1, but costs $6.14 versus Luna $2.05 per 1k, and still has a judge-flagged key flaw. Five cases are insufficient to justify a cost increase for a reliable exact-answer extractor. Existing full-paper cases reproduce the failures; no easier replacements were added. |
| extract-question-formats | No change after fixing the scorer. Ember's wrong JEE partial-credit rule was invisible to the old score. Flash is retained as the fallback because the corrected check catches the consequential marking error. Blind comparison against Flash: 1 win, 1 loss, 5 ties. |
| extract-exam-blueprint | No change; incomplete comparison. Ember completed five Portuguese cases; UPSC document fetch returned 403 before generation. Luna's outputs were retained and scored separately; the remaining fresh incumbent generations were stopped to reserve budget. No English success evidence. |
| research-plan | No change. Luna is cheaper and perfect on the sample; Ember supplied a wrong official domain for TCDF. |
| source-research-plan | No change. Ember costs more and misses the Portuguese quality of Luna/Flash Lite. |
| changing-facts | No change. Production uses Decider V1.2, not the generation default. The six generation smoke cases cover exam/regulation, not product/none, so cannot support replacing its decision route. Ember is also more expensive than Luna on those cases. |
| source-change-notice | No change. Ember costs more and the English software-docs notice violates the no-advice rule. |
| translate-pass-marks | No change. Ember adds an explanatory “Aprovado” parenthetical absent from the Portuguese source, falling below the quality floor in PT. The EN score is 9.50; the PT score is 7.67. All three multilingual cases were tested. |
| check-exam-reading | No change. Ember matches perfect scores but costs more than Luna. |
| check-cited-facts | No change pending broader evidence. Ember is perfect on six cases and cheaper than Flash, but this exact-fact shared-content gate needs broader cases and a blind read before a switch. All supplied cases are retained. |
| read-product-pages | No change pending broader evidence. Ember is a promising cheaper candidate ($2.66/1k versus Luna $3.45/1k); six cases and no paired blind read are insufficient to change this shared factual source reader. |
| compare-release-lessons | No change. Matching scores but Ember costs more than Luna. |
| find-choice-options | No change. Only four cases; cheaper Haiku matches Ember, while the current Luna miss needs a broader comparison before changing a shared research rule. |
| find-course-weights | No change. Luna matches quality at lower cost. |
| find-subject-questions | No change. Ember costs more than Luna and is slower on this sample. |
| find-topic-frequency | No change. Retain incumbent; bounded four-case smoke run does not establish an advantage for Ember. |
| find-official-sources | No change. Ember fails structured-output parsing on all four app-called Parallel cases; all three fresh incumbents complete them. These are schema failures, not provider-policy refusals. |
| find-product-pages | No change. Bounded smoke evidence does not justify changing its chain. |
| find-exam-date | No change. Learner waits on this task; retain incumbent until broader quality and latency evidence establishes a cheaper replacement. |
| find-target-cutoff | No change. Ember scores 9 versus Luna 10 and costs more. |
| image-prompt-safety-rewrite | Tested under its registered ID image-input-safety-rewrite. No change: Ember costs more than Luna on four cases. All five models completed the sensitive-input rewrite cases without refusal. |

## Blind reads and regression evidence

Claude Opus 5.5, high effort, read randomized anonymous pairs. T Social read the first 20 pairs; Personal read ten more image-scene pairs. The account usage skill was run before delegation. Model identities were unblinded only after verdicts were written. `blind-key.json` and `blind-verdicts.json` retain all 30 judgments and concrete reasons. Reads found costs and scores alone would hide JEE's wrong marking rule and wrong answer keys in whole-paper extraction.

Added a partialCredit fact to the deterministic question-format scorer, strengthened the real JEE case to require perOption, and added English/Portuguese fixed-credit regression inputs. Every saved model was rescored on the affected JEE case, including Flash low and Sol; the new cases were run on all seven. No judge changed. The other failures already have retained inputs and expectations in their task's existing cases. No prompt tuning was performed.

Every find task defaults to the app-called Parallel tool; that route was tested with Ember. Provider-native search variants were skipped because Meta has no native gateway search. No task was declared unsupported merely for using an app-called search tool. No policy refusals were observed in completed calls. Initial sandbox gateway failures occurred for every provider and were discarded after successful host-network reruns; these do not count as model failures. The UPSC 403 remains an external source-fetch failure.

## Verification and limits

- `pnpm exec oxfmt` on touched files; `pnpm exec oxlint` on the three changed TypeScript files: passed.
- AI `tsc --noEmit --incremental false`: passed.
- Evals `tsc --noEmit --incremental false`: passed after `next typegen` supplied missing generated PageProps/LayoutProps. The first bare run failed only on those missing generated types.
- Focused AI Vitest: image-scene-schema and extract-exam-blueprint, 2 files / 9 tests passed. No partial-credit test file exists under the requested filename, so the runner exercised the two existing files.
- `node scripts/verify/diff.mts --base HEAD`: only repeated-name prompts for `matches` and `TEST_CASES`. The other matches checks plan-edit operation semantics; each TEST_CASES is a separate task dataset. These intentionally have separate ownership and share no extraction-credit rule.
- The JEE corrected scorer and the two added bilingual cases were exercised through the eval CLI, including all seven saved model configurations. This verifies the new check against model outputs.
- No dev server, native simulator, live learner generations, build, UI or persona pass was run, per the lane brief. Shared generation is served to every client, so there are no client contract changes.
- No design debate was needed for a model-constant change and an eval scoring fix. The lead owns cross-model branch review and the single PR.
- Some search samples contain PT only and some baselines were not rerun on the entire dataset; missing language scores stay blank. These are bounded smoke runs, not exhaustive quality certification. Runtime p50/p95 came from concurrent eval activity on a shared machine and mixed saved/new image cases; do not use them as isolated performance evidence.
- Spend is generation plus extra factual-validation calls plus judges from newly written records, using production pricing and recorded gateway charges. `spend.json` records each file and changed case IDs. Table per-model selected-case spend can include reused outputs; only the incremental ledger is this lane's spend. Completed outputs were saved before the blueprint pipeline stopped.

## Outside-scope observations

- The runner's limited changing-facts sample omits product/none labels; its six cases cannot replace a four-label classifier audit.
- Six check-cited-facts cases and six product-page cases make Ember promising candidates, but require a broader independent blind comparison.
- Source downloads can fail with 403; this is distinguishable from model failures, and source fixtures would improve reproducibility.
- Gemini tool runs emitted missing thought-signature replay warnings; the installed SDK injected its documented sentinel. No dependency was patched.
- The requested safety rewrite directory has a different registered task ID; it was found and tested. This lane did not complete fresh blueprint baselines beyond Luna because of time/spend reservation. No PR was opened or pushed.
