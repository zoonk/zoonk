import { type Decision } from "@/lib/comparisons/decision";
import { caseRunKey } from "@/lib/comparisons/identity";
import { type Comparison } from "@/lib/comparisons/schemas";
import { OUTCOME_LABELS, variantName } from "./labels";
import { plural } from "./words";

export function comparisonTitle(manifest: Comparison["manifest"]): string {
  const { challenger, incumbent } = manifest.variants;

  return incumbent
    ? `${variantName(challenger)} vs ${variantName(incumbent)}`
    : `${variantName(challenger)}, read alone`;
}

/** Major problems on the challenger that a checker from another family confirmed. */
function confirmedProblems(decision: Decision): number {
  const challenger = decision.rows.find((row) => row.side === "challenger");

  return new Set(
    challenger?.quality.flatMap((metric) => metric.affected.map((run) => caseRunKey(run))),
  ).size;
}

/** The outcome in a few words; a read of one output has no outcome, only what readers found. */
export function outcomeText(comparison: Comparison, decision: Decision): string {
  if (!comparison.manifest.variants.incumbent) {
    const unit = comparison.manifest.runs > 1 ? "run" : "case";
    return `${plural(confirmedProblems(decision), unit)} with a confirmed major problem`;
  }

  return OUTCOME_LABELS[decision.outcome];
}
