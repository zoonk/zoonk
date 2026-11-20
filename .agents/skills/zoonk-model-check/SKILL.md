---
name: zoonk-model-check
description: Check whether a new AI model or a changed prompt should replace what a Zoonk task runs today. Triage which tasks are worth checking, forecast the cost, run the comparison against the current model with blind readers from several model families, verify what would decide, and write a decision that weighs quality against cost and latency by the task's priorities. Use when a new model comes out, a price changes, a prompt changes, or someone asks whether a task should switch models.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Model check

A model check answers one question per task: should the challenger (a new model, reasoning level or prompt) replace the incumbent (what production runs today)? It compares the two on the same cases and decides by the task's written priorities. The rules for choosing a model are in [`apps/evals/AGENTS.md`](../../../apps/evals/AGENTS.md) ("Choosing a model"); the commands and their options are in [`apps/evals/README.md`](../../../apps/evals/README.md). This skill is the order to do it in.

## 1. Triage: skip most tasks

A new model is worth checking only where it could win. For each task, compare the challenger's tier and price with the incumbent's:

- Cheaper than the incumbent and not much weaker: check it, since a tie goes to the cheaper model.
- Pricier: check it only for a task whose priorities put quality first and where the incumbent has known weaknesses.
- Same price, same tier: check it only where its family has shown a strength the task needs.
- A task whose output code fully checks (classifiers, extractors) needs only its code checks, never a reader.

Write the list of tasks you'll check and the reason for each skip in your report.

## 2. Forecast before spending

Before generating anything, forecast the cost: the challenger's generation from the task's measured cost per run (never from per-token prices), the number of pair reads, and which readers run on subscription seats and which through the AI Gateway. The comparison command prints this forecast and stops for confirmation above a limit. Ask the user before a forecast that goes past the budget they gave.

## 3. Run the comparison

Run `eval:compare` for the task (see the README). It freezes the cases and their expectations, generates the challenger (two runs a case), reuses the incumbent's outputs whose prompts and inputs match, runs the code checks on both, and seals the outputs before anyone reads them.

- A writer change across model families also changes the lesson's reviewer (`packages/ai/src/tasks/quality/lesson-check-models.ts`), so compare the delivered pipeline (writer, reviewer and fixer), not the writer alone.
- A prompt change is a new variant: compare the changed cases against the frozen outputs from before the change.
- A verified hard failure on the challenger alone (a wrong answer key, a broken schema) ends the check for that task.

## 4. Readers

Readers from Claude and GPT read every pair, so the view of what's wrong is balanced whichever family wrote the outputs. When the two rivals are a Claude model and a GPT model, a third family reads too (Gemini 4 Neon; older Gemini models aren't good enough). Readers get only the packet: no tools, no repository, no model names.

Use subscription seats first. When a seat runs out, wait if it resets within 4 hours; otherwise read through the gateway without asking. A seat counts only after it's shown to run the requested model with no tools and no project or user context; otherwise that family reads through the gateway.

Every packet carries controls (an identical pair and a known defect). A packet whose reader fails a control doesn't count; keep the attempt and read it again.

## 5. Verify only what would decide

Send to a verifier from another family only the observations that would change the decision: a major observation on a case that decides the trade, or a claim the decision rests on. The verifier checks the claim against both outputs and the case's expectation. Don't verify the rest.

## 6. Decide

The decision weighs quality against cost and latency by the task's `priorities` (in its `task.ts`): which criteria disqualify, which count toward the trade, and the trade the task accepts. A tie goes to the cheaper model, and so can a small quality loss when the saving is large. When unverified claims, unresolved cases or missing outputs could reverse the choice, keep the incumbent and say what evidence is missing.

- Shared content (Library lessons, items, courses): the owner reads the decisive cases before the switch. Put them in front of them in the evals app's comparison page and wait.
- Private content (one learner's own): take the cheaper variant on shown practical equivalence without waiting.

The comment beside the production model cites the comparison.

## 7. Turn what you found into cases

- A verified observation that recurs or matters becomes a case expectation, a new case, or a code check shared with the production pipeline (`apps/evals/AGENTS.md`, "Regression cases").
- New cases come from published shared Library content (lessons, specs, challenges), read through the staff CLI ([zoonk-staff-data](../zoonk-staff-data/SKILL.md)) and marked `origin: "production"`. Never a learner's own data.

## Report

For each task checked: the decision, the decision table's numbers (coverage, quality, delivery), the decisive cases, what was verified and what wasn't, gateway spend and seat time. For each task skipped: why.
