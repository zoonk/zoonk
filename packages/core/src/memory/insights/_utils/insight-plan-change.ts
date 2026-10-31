import "server-only";
import { proposePlanChange } from "../../../plans/propose-plan-change";
import { type PrerequisiteGap } from "./prerequisite-gaps";

export type InsightPlanChange = { planChangeId: string; planChangeStatus: "applied" | "proposed" };

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
