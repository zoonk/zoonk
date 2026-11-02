import "server-only";
import { randomUUID } from "node:crypto";
import { type CourseLevel, type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearningProfileCacheTag } from "../cache/tags";
import { arePhaseChallengesRequired } from "../checkpoints/_utils/phase-challenge-access";
import { findOwnedGoal, getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { loadPlanCourse } from "../plans/_utils/plan-course";
import { isPlanFinished } from "../plans/_utils/plan-end";
import { parsePlanPhases, parsePlanSettings } from "../plans/planner/plan-state";
import { insertGoalWithPlan, setActiveGoal } from "./_utils/create-goal-records";
import { loadGoalViews } from "./_utils/goal-view";
import { trackGoalReached } from "./_utils/track-goal-reached";
import { type GoalView } from "./goal-contract";

export type NextLevelResult =
  | { goal: GoalView; status: "created" }
  | { status: "noNextLevel" | "notFinished" | "notFound" | "unauthorized" };

const OWN_LEVEL_BEFORE: Record<CourseLevel, string> = {
  advanced: "advanced",
  beginner: "basic",
  intermediate: "intermediate",
  overview: "none",
};

const ONBOARDING_FIELDS = new Set(["answered", "onboardingId", "onboardingPlace"]);

function buildNextDetails({ goal, level }: { goal: Goal; level: CourseLevel }) {
  const details = isJsonObject(goal.details) ? goal.details : {};
  const kept = Object.entries(details).filter(([key]) => !ONBOARDING_FIELDS.has(key));

  return {
    ...Object.fromEntries(kept),
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

  const { goal, userId } = owned;

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

  const phaseChallengesRequired = await arePhaseChallengesRequired({ goalKind: goal.kind, userId });

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

  const [course, studyDays] = await Promise.all([
    loadPlanCourse({ goal, items }),
    loadStudyDays(goalId),
  ]);

  if (goal.kind !== "learn" || !course?.nextLevel) {
    return { status: "noNextLevel" };
  }

  const { nextLevel } = course;
  const nextId = randomUUID();

  const completed = await writeLearnerChange<boolean, null>(
    { planInputs: true, userId },
    async (tx) => {
      if (await tx.goal.findUnique({ select: { id: true }, where: { replacesGoalId: goal.id } })) {
        return unchanged(null);
      }

      const { count } = await tx.goal.updateMany({
        data: { status: "completed" },
        where: { id: goal.id, status: { not: "completed" } },
      });

      await insertGoalWithPlan(tx, {
        dailyMinutes: goal.dailyMinutes,
        draft: {
          details: buildNextDetails({ goal, level: nextLevel }),
          kind: "learn",
          language: goal.language,
          primaryCourseId: course.courseId,
          prompt: goal.prompt,
          title: course.title,
        },
        id: nextId,
        input: {
          studyDays,
          studyTime: goal.studyTime ?? undefined,
          timeZone: goal.timezone ?? undefined,
        },
        replacesGoalId: goal.id,
        testedLanguage: null,
        userId,
      });

      await setActiveGoal(tx, { activeGoalId: nextId, userId });
      return count > 0;
    },
  );

  if (completed === null) {
    return { status: "noNextLevel" };
  }

  if (completed) {
    trackGoalReached(goal);
  }

  revalidateCacheTags([getGoalsCacheTag(userId), getLearningProfileCacheTag(userId)]);

  const next = await prisma.goal.findUniqueOrThrow({ where: { id: nextId } });
  const [view] = await loadGoalViews({ activeGoalId: nextId, goals: [next] });

  return view ? { goal: view, status: "created" } : { status: "notFound" };
}
