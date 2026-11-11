# Level-test-bank writer verdict, 11 Nov 2026

Switch to Claude Fable 5.2, with Opus 5.5 first fallback, then Sonnet 5.5 and Terra. This is shared Library content, so the measured extra $1.47 per bank is justified by clearer answer separation and stronger prose: Fable won six cases, lost one and tied one in the blind read. Across 160 questions and 40 speaking sentences per model, Fable has one confirmed wrong key; Opus has two ambiguous keys. Neither has a confirmed level flaw. Opus also has two numeric localization defects. Judges flagged one key-flawed bank for each model, missing the additional French workplace ambiguity.

These are qualitative judgments on eight generated banks each, not a statistical reliability estimate or empirical CEFR calibration. Fable still has a real afternoon-clock defect. The switch meets the requested comparative rule, not a claim of error-free content.

## Per-case evidence

Scores are the average of Astra and Argon battle scores on the same pair outputs. Historical battles include other writers in their panels; the four new panels contain only these two writers. Costs are measured generation dollars per bank, excluding judges. K/L/O means confirmed key / level / other flaws. Verdicts are relative to Fable.

| Case | Fable score | Opus score | Fable $ | Opus $ | Fable K/L/O | Opus K/L/O | Fable verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pt-en-1 | 9.175 | 7.125 | 1.96598 | 0.62981 | 0/0/0 | 1/0/0 | better |
| en-pt-1 | 8.700 | 8.400 | 1.94326 | 0.63249 | 0/0/0 | 0/0/1 | better |
| es-en-1 | 9.500 | 9.050 | 2.03874 | 0.61945 | 0/0/0 | 0/0/0 | better |
| de-en-1 | 8.175 | 9.125 | 2.28614 | 0.70155 | 1/0/0 | 0/0/1 | worse |
| en-ar-fable-1 | 9.125 | 8.700 | 2.25922 | 0.68223 | 0/0/0 | 0/0/0 | better |
| pt-ar-fable-1 | 9.375 | 8.775 | 2.48264 | 0.66968 | 0/0/0 | 0/0/0 | better |
| fr-de-fable-1 | 9.250 | 9.000 | 2.05880 | 0.64920 | 0/0/0 | 1/0/0 | better |
| ja-en-fable-1 | 8.375 | 9.175 | 1.97262 | 0.63307 | 0/0/0 | 0/0/0 | tie |

Eight-case averages: Fable 8.959 at $2.12592 per bank ($2,125.92 per 1,000); Opus 8.669 at $0.65218 ($652.18 per 1,000). No failed/refused new generations; code checks pass 88/88 groups per model across the eight selected cases. Latency is retained per case in metrics.json and is not a decision constraint for background writing.

## Reasons recorded before unblinding

### pt-en-1

B Q17 offers both withholding recommendation (0) and liking food despite affectation (3); both are defensible. A has sustained inference, clear unique answers and natural Brazilian Portuguese.

Mapping: A = anthropic-claude-fable-5.2, B = anthropic-claude-opus-5.5.

### en-pt-1

B Q6 uses R$ 1.600 in US English options rather than 1,600. A has stronger mixed-view C1 prose and reasoning; B keys remain defensible.

Mapping: A = anthropic-claude-fable-5.2, B = anthropic-claude-opus-5.5.

### es-en-1

Both banks have unique defensible keys. B has richer C1 nostalgia and implicit stance, and more convincing competing readings. No confirmed level defect in A.

Mapping: A = anthropic-claude-opus-5.5, B = anthropic-claude-fable-5.2.

### de-en-1

A Q3 keys afternoon departure as 3:15 Uhr rather than 15:15. B Q1 uses US decimal dots in German price options. Both increase appropriately through C1; B wins on correctness.

Mapping: A = anthropic-claude-fable-5.2, B = anthropic-claude-opus-5.5.

### en-ar-fable-1

All 20 keys and 5 translations in both banks are defensible, with plausible wrong alternatives and clear A1-C1 progression. MSA script and agreement fit. B has more distinctive voices, especially the vegetable-box humor and engineer's qualified approval. A is sound but uses more familiar stock productivity framing. Slight B preference, not a correctness difference.

Mapping: A = anthropic-claude-opus-5.5, B = anthropic-claude-fable-5.2.

### pt-ar-fable-1

All 20 keys and 5 translations per bank checked. No confirmed wrong or ambiguous key, misleveling, language defect or instruction leak. A is more distinctive: the indirect request for a call room at B2 and the self-ironic office preference and machine-translation qualification at C1 are more discriminating than B. Bare seven/eight in A Q7 retains the reservation context, without competing AM/PM options; not counted as a wrong key.

Mapping: A = anthropic-claude-fable-5.2, B = anthropic-claude-opus-5.5.

### fr-de-fable-1

B Q13 says management explained the decision and its numbers are hardly disputable, while the writer wistfully packs plants. French option 0 (convinced by management arguments) is compatible with option 1 (accepts without really approving). No wording in option 0 excludes personal reluctance. Both are defensible; require unequivocally wrong opposition rather than conflating reasoned acceptance with enthusiasm. All other keys, alternatives and five translations checked; no confirmed level or language defects or leaks. A wins on answer separation and the C1 formal/informal hierarchy contrast.

Mapping: A = anthropic-claude-fable-5.2, B = anthropic-claude-opus-5.5.

### ja-en-fable-1

All 20 keys, distractors and 5 speaking translations checked per bank. Both have natural Japanese, faithful amounts and AM/PM distinctions, distinct A1-C1 demands and nuanced C1 stance. No instruction leaks or confirmed key/level/language defects. A has strong office/social-cost implications; B has equally effective register contrast and a qualified family-care choice. No meaningful overall quality difference.

Mapping: A = anthropic-claude-fable-5.2, B = anthropic-claude-opus-5.5.

## Method and regressions

A scratch-only Python script at `/tmp/level-bank-blind/pair.py` used `secrets.SystemRandom().shuffle` independently for each case, displayed only the output and anonymous A/B labels, and wrote each mapping separately. Initial verdicts were written before opening the initial mapping; all four new verdicts were written before opening their mappings. GPT-6.1-Sol shares neither writer family. Every question was checked against every option for a unique key, plausible wrong alternatives, level, language/localization and instruction leakage; every speaking sentence was checked for level, naturalness and translation fidelity. Initial and new item matrices retain the judgments. Familiarity with the two known failures supplied in the request limits blinding on those items. No helper agents were used.

The original suite already covered EN/PT/ES/FR/DE pairs. Four new comparison cases add Arabic target text and French and Japanese learner-language fields; every bank still exercises all five A1-C1 bands, as required by the task API. Additional regression work preserves the same failing pair inputs: existing clock and restaurant-ambiguity cases cover the known key failures; the clock case now also checks German decimals, a new EN/PT price case checks English thousands separators, and a new FR/DE workplace case forbids compatible mixed-attitude answers. No production prompt was modified, so the compared saved outputs remain representative. These regression expectations expose failures; they do not repair already generated banks.

The judges score Opus higher on Japanese while the blind read finds a tie: both satisfy the concrete level/key checks, and the remaining difference is a subjective calibration/prose assessment. The additional French ambiguity is preserved as a separate case rather than silently overwriting existing scored expectations. The new/changed regression IDs have no saved outputs in any model, so no existing result requires rescoring.

## Spend and reproducibility

New generation spend $11.407448; judges $0.879464; total $12.286912, below the $15 cap. Existing saved outputs and judgments were read without additional calls. No logs are committed.

For each of `en-ar-fable`, `pt-ar-fable`, `fr-de-fable`, `ja-en-fable`, run:

```sh
pnpm --filter evals eval:run --task level-test-bank --model anthropic/claude-opus-5.5 --model anthropic/claude-fable-5.2 --case <case> --battle
```

One run per case, no `--swap`, no regeneration of historical banks. `--saved` reports retained results without calls. Saved bank outputs live in `../outputs/level-test-bank/anthropic-claude-{fable-5.2,opus-5.5}.json`; judgments live in `../battles/level-test-bank/<case>-1.json`. The four initial cases are `pt-en`, `en-pt`, `es-en`, `de-en`, each at run 1. `metrics.json` extracts exactly those eight paired case-runs and records scores by judge, costs, latency and code checks.

## Current catalog and lifecycle

Checked the current [AI Gateway catalog](https://ai-gateway.vercel.sh/v1/models), [Anthropic model overview](https://platform.claude.com/docs/en/models/overview), [Anthropic lifecycle table](https://platform.claude.com/docs/en/about-claude/model-deprecations) and [OpenAI deprecations](https://developers.openai.com/api/docs/deprecations) on 11 Nov 2026. Fable 5.2, Opus 5.5 and Sonnet 5.5 are active, with retirement not sooner than Nov 9, Sep 22 and Sep 28, 2027, respectively. Terra remains catalog-listed; no Terra 6.1 shutdown date was found. The eval ran the requested gateway IDs with fallback disabled, and the production fallback order remains a separately asserted contract.
