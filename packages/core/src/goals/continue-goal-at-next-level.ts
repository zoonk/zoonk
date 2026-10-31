import "server-only";
import { type CourseLevel, type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { arePhaseChallengesRequired } from "../checkpoints/_utils/phase-challenge-access";
import { findOwnedGoal, getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { loadPlanCourse } from "../plans/_utils/plan-course";
import { isPlanFinished } from "../plans/_utils/plan-end";
import { parsePlanPhases, parsePlanSettings } from "../plans/planner/plan-state";
import { trackGoalReached } from "./_utils/track-goal-reached";
import { createGoals } from "./create-goals";
import { type GoalView } from "./goal-contract";

export type NextLevelResult =
  | { goal: GoalView; status: "created" }
  | { status: "noNextLevel" | "notFinished" | "notFound" | "refused" | "unauthorized" };

const OWN_LEVEL_BEFORE: Record<CourseLevel, string> = {
  advanced: "advanced",
  beginner: "basic",
  intermediate: "intermediate",
  overview: "none",
};

const ONBOARDING_FIELDS = new Set(["answered", "onboardingId"]);

function buildNextDetails({ goal, level }: { goal: Goal; level: CourseLevel }) {
  const details = isJsonObject(goal.details) ? goal.details : {};
  const kept = Object.entries(details).filter(([key]) => !ONBOARDING_FIELDS.has(key));

  return {
    ...Object.fromEntries(kept),
    continuesFromGoalId: goal.id,
    courseLevel: level,
    level: OWN_LEVEL_BEFORE[level],
    purpose: details.purpose === "overview" ? "deep" : (details.purpose ?? "deep"),
  };
}

async function loadStudyDays(goalId: string): Promise<number[] | undefined> {
  const plan = await prisma.plan.findUnique({ select: { settings: true }, where: { goalId } });
  const minutes = parsePlanSettings(plan?.settings).weekdayMinutes;

  return minutes?.flatMap((dayMinutes, weekday) => (dayMinutes > 0 ? [weekday] : []));
}

export async function continueGoalAtNextLevel(goalId: string): Promise<NextLevelResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal } = owned;

  const plan = await prisma.plan.findUnique({
    select: {
      items: {
        select: { chapterId: true, kind: true, lessonId: true, scheduledFor: true, status: true },
      },
      phases: true,
    },
    where: { goalId },
  });

  const items = plan?.items ?? [];

  const today = getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) });

  const phaseChallengesRequired = await arePhaseChallengesRequired({
    goalKind: goal.kind,
    userId: owned.userId,
  });

  if (
    !isPlanFinished({
      goalKind: goal.kind,
      items,
      phaseChallengesRequired,
      phases: parsePlanPhases(plan?.phases),
      targetDate: goal.targetDate,
      today,
    })
  ) {
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

  if (goal.kind !== "learn" || !course?.nextLevel) {
    return { status: "noNextLevel" };
  }

  await writeLearnerChange({ planInputs: true, userId: owned.userId }, async (tx) => {
    const updated = await tx.goal.updateMany({
      data: { status: "completed" },
      where: { id: goal.id, status: { not: "completed" } },
    });

    if (updated.count === 0) {
      return unchanged(null);
    }
  });

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
    await writeLearnerChange({ planInputs: true, userId: owned.userId }, async (tx) => {
      const current = await tx.goal.findUnique({ where: { id: goal.id } });

      if (!current || current.status === goal.status) {
        return unchanged(null);
      }

      await tx.goal.update({ data: { status: goal.status }, where: { id: goal.id } });
    });

    return { status: "refused" };
  }

  if (goal.status !== "completed") {
    trackGoalReached(goal);
  }

  return { goal: next, status: "created" };
}
