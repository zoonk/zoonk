import "server-only";
import { type GoalKind, prisma, sql } from "@zoonk/db";
import { PHASE_WORK_KINDS } from "../../plans/_utils/phase-states";
import { parsePlanPhases } from "../../plans/planner/plan-state";

export type PlanPhaseFacts = {
  firstTodoPhase: number | null;
  firstTodoPhaseBesideChallenges: number | null;
  goalId: string;
  goalKind: GoalKind;
  hasItems: boolean;
  phases: unknown;
  planId: string;
  userId: string;
};

const WORK_KINDS = [...PHASE_WORK_KINDS];
const LESSON_WORK_KINDS = WORK_KINDS.filter((kind) => kind !== "boss");

export async function loadPlanPhaseFacts(
  scope: { planIds: readonly string[] } | { userId: string },
): Promise<PlanPhaseFacts[]> {
  const where =
    "planIds" in scope
      ? sql`p.id = ANY(${[...scope.planIds]}::uuid[])`
      : sql`g.user_id = ${scope.userId}::uuid AND g.status <> 'archived'`;

  return prisma.$queryRaw<PlanPhaseFacts[]>`
    SELECT
      p.id AS "planId",
      p.goal_id AS "goalId",
      p.phases,
      g.kind::text AS "goalKind",
      g.user_id AS "userId",
      EXISTS (SELECT 1 FROM plan_items i WHERE i.plan_id = p.id) AS "hasItems",
      (
        SELECT min(i.phase)::int FROM plan_items i
        WHERE i.plan_id = p.id AND i.status = 'todo' AND i.kind::text = ANY(${WORK_KINDS}::text[])
      ) AS "firstTodoPhase",
      (
        SELECT min(i.phase)::int FROM plan_items i
        WHERE i.plan_id = p.id AND i.status = 'todo'
          AND i.kind::text = ANY(${LESSON_WORK_KINDS}::text[])
      ) AS "firstTodoPhaseBesideChallenges"
    FROM plans p
    JOIN goals g ON g.id = p.goal_id
    WHERE ${where}`;
}

export function getCurrentPhaseFromFacts({
  facts,
  phaseChallengesRequired,
}: {
  facts: PlanPhaseFacts;
  phaseChallengesRequired: boolean;
}): number | null {
  const left = phaseChallengesRequired
    ? facts.firstTodoPhase
    : facts.firstTodoPhaseBesideChallenges;

  const phaseCount = parsePlanPhases(facts.phases).length;

  if (left !== null) {
    return left;
  }

  return facts.hasItems && phaseCount > 0 ? phaseCount - 1 : null;
}
