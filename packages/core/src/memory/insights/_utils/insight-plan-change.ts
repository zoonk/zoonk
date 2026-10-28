import "server-only";
import { proposePlanChange } from "../../../plans/propose-plan-change";
import { type PrerequisiteGap } from "./prerequisite-gaps";

export type InsightPlanChange = { planChangeId: string; planChangeStatus: "applied" | "proposed" };

/**
 * Adds what a plan-change insight's gap needs (its prerequisites in teaching order, right before
 * the skill they prepare for) through the planner, which applies a one-lesson change at once with
 * an undo and keeps anything bigger as a proposal, with its effect on the end date, for the
 * learner's OK. Null when the plan can't take it (not built yet, or the lessons don't fit), and
 * the insight is then not shown, since its message would point at nothing.
 */
export async function proposeInsightGap({
  gap,
  goalId,
  provenance,
  reason,
}: {
  gap: PrerequisiteGap;
  goalId: string;
  provenance: { generatedAt: Date; model: string; promptVersion: string; runId: string };
  reason: string;
}): Promise<InsightPlanChange | null> {
  const result = await proposePlanChange({
    goalId,
    operations: [
      {
        kind: "addSkills",
        skills: gap.skills.map((skill) => ({
          area: null,
          beforeSkillId: gap.beforeSkill.id,
          lessons: skill.lessons,
          name: skill.name,
          skillId: skill.id,
        })),
      },
    ],
    provenance,
    reason,
    source: "memory",
  });

  if (result.status !== "applied" && result.status !== "proposed") {
    return null;
  }

  return { planChangeId: result.changeId, planChangeStatus: result.status };
}
