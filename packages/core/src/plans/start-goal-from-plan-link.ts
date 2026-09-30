import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { findActiveGoalId, loadGoalViews } from "../goals/_utils/goal-view";
import { type GoalRefusal, createGoals } from "../goals/create-goals";
import { type GoalView } from "../goals/goal-contract";
import { getSession } from "../users/get-session";
import { getLinkSubject, keepPublicGraph, loadLinkedPlan } from "./_utils/linked-plan";
import { createGoalPlan } from "./create-goal-plan";
import { type PlanLinkStartInput } from "./plan-link-contract";
import { parsePlanGraph } from "./planner/plan-state";

export type PlanLinkStartResult =
  | { goal: GoalView; status: "created" | "owner" }
  | { refusals: GoalRefusal[]; status: "refused" }
  | { status: "invalidReference" | "notFound" | "titleRequired" | "unauthorized" };

async function getOwnGoalView({ goalId, userId }: { goalId: string; userId: string }) {
  const [goal, activeGoalId] = await Promise.all([
    prisma.goal.findUniqueOrThrow({ where: { id: goalId } }),
    findActiveGoalId(userId),
  ]);

  const [view] = await loadGoalViews({ activeGoalId, goals: [goal] });
  return view;
}

/**
 * Starts the learner's own goal from someone's plan link: the same kind, subject and exam, and a
 * copy of the plan's structure (its phases and skills), planned at the learner's own time. Nothing
 * of the owner's comes along: their answers, dates, pace and progress stay theirs. Placement
 * then adjusts the new plan to what the learner already knows. Guests can start one too.
 */
export async function startGoalFromPlanLink({
  input,
  planId,
}: {
  input: PlanLinkStartInput;
  planId: string;
}): Promise<PlanLinkStartResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const source = isUuid(planId) ? await loadLinkedPlan(planId) : null;

  if (!source) {
    return { status: "notFound" };
  }

  if (source.goal.userId === session.user.id) {
    const goal = await getOwnGoalView({ goalId: source.goal.id, userId: session.user.id });
    return goal ? { goal, status: "owner" } : { status: "notFound" };
  }

  const subject = getLinkSubject(source.goal);
  const title = input.title ?? subject?.title;

  if (!title) {
    return { status: "titleRequired" };
  }

  const created = await createGoals({
    dailyMinutes: input.dailyMinutes,
    goals: [
      {
        examBlueprintId:
          source.goal.examBlueprint?.visibility === "public"
            ? source.goal.examBlueprint.id
            : undefined,
        kind: source.goal.kind,
        language: source.goal.language,
        primaryCourseId:
          source.goal.primaryCourse?.visibility === "public"
            ? source.goal.primaryCourse.id
            : undefined,
        prompt: title,
        targetDate: input.targetDate,
        targetLanguage: source.goal.targetLanguage ?? undefined,
        title,
      },
    ],
    studyDays: input.studyDays,
    studyTime: input.studyTime,
    timeZone: input.timeZone,
  });

  if (created.status === "refused") {
    return { refusals: created.refused, status: "refused" };
  }

  if (created.status !== "created" || !created.goals[0]) {
    return { status: created.status === "created" ? "notFound" : created.status };
  }

  const [goal] = created.goals;

  await createGoalPlan({
    fromPlanLink: true,
    goalId: goal.id,
    graph: await keepPublicGraph(parsePlanGraph(source.graph)),
  });

  return {
    goal: (await getOwnGoalView({ goalId: goal.id, userId: session.user.id })) ?? goal,
    status: "created",
  };
}
