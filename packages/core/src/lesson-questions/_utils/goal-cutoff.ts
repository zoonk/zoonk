import "server-only";
import { type PlanScopeContext } from "@zoonk/ai/tasks/lessons/question-context";
import { type Goal } from "@zoonk/db";
import { loadTargetCutoff } from "../../exams/cutoffs/load-target-cutoff";

/** The target's last cut-off in a few words, for the buddy to say where the bar was. */
export async function loadGoalCutoff(goal: Goal): Promise<PlanScopeContext["goal"]["cutoff"]> {
  const cutoff = await loadTargetCutoff({
    details: goal.details,
    examBlueprintId: goal.examBlueprintId,
  });

  if (!cutoff) {
    return null;
  }

  const target = [cutoff.course, cutoff.position, cutoff.course ? cutoff.institution : null]
    .filter(Boolean)
    .join(", ");

  return {
    edition: cutoff.edition,
    quota: cutoff.quota,
    score: cutoff.score,
    source: cutoff.source.url,
    target,
  };
}
