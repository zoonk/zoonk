import "server-only";
import { type CourseLevel, type GoalKind, prisma, sql } from "@zoonk/db";
import { LEARN_KINDS, PHASE_WORK_KINDS } from "../../plans/planner/plan-item-rules";
import { parsePlanPhases } from "../../plans/planner/plan-state";

export type PlanPhaseFacts = {
  firstTodoPhase: number | null;
  firstTodoPhaseBesideChallenges: number | null;
  goalId: string;
  goalKind: GoalKind;
  hasItems: boolean;
  /**
   * The level of the plan's next lesson in the primary course: a chapter placed there, or a stand-in
   * whose skill the graph doesn't map to another course (its skill's level).
   */
  nextLevel: CourseLevel | null;
  phases: unknown;
  planId: string;
  userId: string;
};

const WORK_KINDS = [...PHASE_WORK_KINDS];
const LESSON_WORK_KINDS = WORK_KINDS.filter((kind) => kind !== "boss");
const LEARN = [...LEARN_KINDS];

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
      ) AS "firstTodoPhaseBesideChallenges",
      (
        SELECT COALESCE(cc.level::text, s.level::text) FROM plan_items i
        LEFT JOIN course_chapters cc
          ON cc.chapter_id = i.chapter_id AND cc.course_id = g.primary_course_id
        LEFT JOIN skills s ON s.id = i.skill_id
        WHERE i.plan_id = p.id AND i.status = 'todo' AND i.kind::text = ANY(${LEARN}::text[])
          AND (
            cc.course_id IS NOT NULL
            OR (
              i.chapter_id IS NULL
              AND i.skill_id::text NOT IN (
                SELECT sk ->> 'skillId'
                FROM jsonb_array_elements(
                  CASE WHEN jsonb_typeof(p.graph -> 'skills') = 'array'
                    THEN p.graph -> 'skills' ELSE '[]'::jsonb END
                ) AS sk
                WHERE sk ->> 'skillId' IS NOT NULL
                  AND sk -> 'courseIds' ->> 0 <> g.primary_course_id::text
              )
            )
          )
        ORDER BY i.scheduled_for ASC NULLS LAST, i.position ASC
        LIMIT 1
      ) AS "nextLevel"
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
