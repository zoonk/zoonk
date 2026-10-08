import "server-only";
import { type CourseLevel, type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { isPlanFinished, loadPlanCourse } from "../plans/_utils/plan-course";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { trackGoalReached } from "./_utils/track-goal-reached";
import { createGoals } from "./create-goals";
import { type GoalView } from "./goal-contract";

export type NextLevelResult =
  | { goal: GoalView; status: "created" }
  | { status: "noNextLevel" | "notFinished" | "notFound" | "refused" | "unauthorized" };

/**
 * What the learner knows after finishing a level, in onboarding's own-level answer: the overview
 * gives the basics, and each level after it the one before the next.
 */
const OWN_LEVEL_BEFORE: Record<CourseLevel, string> = {
  advanced: "advanced",
  beginner: "basic",
  intermediate: "intermediate",
  overview: "none",
};

/** Onboarding's bookkeeping stays with the finished goal: the next one has nothing to ask. */
const ONBOARDING_FIELDS = new Set(["answered", "onboardingId"]);

function buildNextDetails({ goal, level }: { goal: Goal; level: CourseLevel }) {
  const details = isJsonObject(goal.details) ? goal.details : {};
  const kept = Object.entries(details).filter(([key]) => !ONBOARDING_FIELDS.has(key));

  return {
    ...Object.fromEntries(kept),
    continuesFromGoalId: goal.id,
    courseLevel: level,
    level: OWN_LEVEL_BEFORE[level],
    // An overview is the big picture; going on to a level means going in depth.
    purpose: details.purpose === "overview" ? "deep" : (details.purpose ?? "deep"),
  };
}

/** The finished plan's study days carry over; every day when it had no weekly shape. */
async function loadStudyDays(goalId: string): Promise<number[] | undefined> {
  const plan = await prisma.plan.findUnique({ select: { settings: true }, where: { goalId } });
  const minutes = parsePlanSettings(plan?.settings).weekdayMinutes;

  return minutes?.flatMap((dayMinutes, weekday) => (dayMinutes > 0 ? [weekday] : []));
}

/**
 * "Continue at Beginner" once a plan is done: the finished goal is completed and a new goal takes
 * its place for the next level of the same course, with the learner's time, study days and what
 * onboarding understood, so its curriculum and plan are written without asking again. It takes the
 * finished goal's place, so it isn't another goal against the plan's limits, and a goal goes on to
 * its next level once, so continuing again can't make unlimited goals. The finished goal comes
 * back if the new one can't be created.
 */
export async function continueGoalAtNextLevel(goalId: string): Promise<NextLevelResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal } = owned;

  const items = await prisma.planItem.findMany({
    select: { chapterId: true, kind: true, lessonId: true, status: true },
    where: { plan: { goalId } },
  });

  if (!isPlanFinished(items)) {
    return { status: "notFinished" };
  }

  const continued = await prisma.goal.count({
    where: { details: { equals: goal.id, path: ["continuesFromGoalId"] }, userId: owned.userId },
  });

  if (continued > 0) {
    return { status: "noNextLevel" };
  }

  const [course, studyDays] = await Promise.all([
    loadPlanCourse({ goal, items }),
    loadStudyDays(goalId),
  ]);

  // Only learn goals climb a course's levels; exams and languages have their own ladders.
  if (goal.kind !== "learn" || !course?.nextLevel) {
    return { status: "noNextLevel" };
  }

  await prisma.goal.update({ data: { status: "completed" }, where: { id: goal.id } });

  const created = await createGoals(
    {
      dailyMinutes: goal.dailyMinutes,
      goals: [
        {
          details: buildNextDetails({ goal, level: course.nextLevel }),
          kind: "learn",
          language: goal.language,
          primaryCourseId: course.courseId,
          prompt: goal.prompt,
          title: course.title,
        },
      ],
      studyDays,
      studyTime: goal.studyTime ?? undefined,
      timeZone: goal.timezone ?? undefined,
    },
    { replacesGoalId: goal.id },
  );

  const [next] = created.status === "created" ? created.goals : [];

  if (!next) {
    await prisma.goal.update({ data: { status: goal.status }, where: { id: goal.id } });
    return { status: "refused" };
  }

  if (goal.status !== "completed") {
    trackGoalReached(goal);
  }

  return { goal: next, status: "created" };
}
