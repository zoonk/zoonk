import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { type PlanGraphSkill, parsePlanGraph } from "../../plans/planner/plan-state";

export type OtherExamGoal = {
  goalId: string;
  name: string;
  skills: Pick<PlanGraphSkill, "courseIds" | "skillId">[];
};

/** GET-only, after ownership authorization. Skill ids are as saved: callers resolve merges. */
export async function readOtherExamGoals(userId: string, goalId: string): Promise<OtherExamGoal[]> {
  "use cache: private";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  const goals = await prisma.goal.findMany({
    include: { examBlueprint: { select: { name: true } }, plan: { select: { graph: true } } },
    orderBy: { createdAt: "asc" },
    where: { id: { not: goalId }, kind: "exam", status: { in: ["active", "paused"] }, userId },
  });

  return goals.flatMap((goal) =>
    goal.plan
      ? [
          {
            goalId: goal.id,
            name: goal.examBlueprint?.name ?? goal.title,
            skills: parsePlanGraph(goal.plan.graph).skills.map(({ courseIds, skillId }) => ({
              courseIds,
              skillId,
            })),
          },
        ]
      : [],
  );
}
