import "server-only";
import { type GoalTutorLookUpResult } from "@zoonk/ai/tasks/tutor/goal-tutor-lookup";
import { type Goal } from "@zoonk/db";
import { getCatalogCourseProgress } from "../../../catalog/progress";
import { listCurrentUserCourses } from "../../../courses/list-current-user-courses";
import { getReachedCap } from "../../../entitlements/contract";
import { getAllowance } from "../../../entitlements/get-allowance";
import { listCurrentUserGoals } from "../../../goals/list-current-user-goals";
import { isMemoryEnabled } from "../../../memory/_utils/memory-access";
import { getLearningProfile } from "../../../profile/get-learning-profile";
import { type Lookup, toPageLink } from "./learner-page-link";
import { matchesQuery } from "./lookup-text";

const MAX_GOALS = 10;

const MAX_COURSES = 5;

const SECONDS_PER_MINUTE = 60;

/** Excludes archived goals and puts the open goal first. */
export async function lookUpGoals({ goal, scope }: Lookup): Promise<GoalTutorLookUpResult> {
  const what = "goals";
  const list = await listCurrentUserGoals();

  if (!list || list.goals.length === 0) {
    return { status: "notFound", what };
  }

  return {
    dailyMinutes: list.dailyMinutes,
    goals: list.goals
      .slice(0, MAX_GOALS)
      .map((view) => ({
        dailyMinutes: view.dailyMinutes,
        kind: view.kind,
        link: view.isActive ? toPageLink({ page: "plan", scope }) : null,
        open: view.isActive,
        plan: view.plan && {
          endDate: view.plan.endDate,
          lessonsDone: view.plan.lessonsDone,
          lessonsTotal: view.plan.lessonsTotal,
        },
        status: view.status,
        targetDate: view.targetDate,
        thisGoal: view.id === goal.id,
        title: view.title,
      })),
    moreGoals: Math.max(0, list.goals.length - MAX_GOALS),
    status: "found",
    what,
  };
}

function toMinutesLeft({ limit, used }: { limit: number | null; used: number }): number | null {
  return limit === null ? null : Math.floor(Math.max(0, limit - used) / SECONDS_PER_MINUTE);
}

/** Never returns prices. */
export async function lookUpAccount({ goal, scope }: Lookup): Promise<GoalTutorLookUpResult> {
  const what = "account";

  const [allowance, profile, memoryEnabled] = await Promise.all([
    getAllowance(),
    getLearningProfile(),
    isMemoryEnabled(goal.userId),
  ]);

  if (!allowance || !profile) {
    return { status: "notFound", what };
  }

  const callTime = allowance.items.find((item) => item.kind === "conversation");

  if (!callTime) {
    throw new Error("Conversation allowance missing");
  }

  const noCalls = getReachedCap({ allowance, kind: "conversation" })?.period === "total";

  return {
    callMinutesLeft: noCalls
      ? { last30Days: 0, today: 0 }
      : {
          last30Days: toMinutesLeft({
            limit: callTime.rollingLimit,
            used: callTime.usedLast30Days,
          }),
          today: toMinutesLeft({ limit: callTime.dailyLimit, used: callTime.usedToday }),
        },
    link: toPageLink({ page: "settings", scope }),
    memory: { enabled: memoryEnabled, link: toPageLink({ page: "memory", scope }) },
    plan: { link: toPageLink({ page: "subscription", scope }), tier: allowance.tier },
    preferences: {
      buddyName: profile.buddy.name,
      link: toPageLink({ page: "appearance", scope }),
      sounds: profile.soundsEnabled,
    },
    status: "found",
    what,
  };
}

async function toCourse({ course, goal }: { course: { id: string; title: string }; goal: Goal }) {
  const progress = await getCatalogCourseProgress({ courseId: course.id });

  return {
    lessonsDone: (progress?.chapters ?? []).reduce(
      (total, chapter) => total + chapter.completedLessons,
      0,
    ),
    percentDone: progress?.percentComplete ?? null,
    thisGoal: course.id === goal.primaryCourseId,
    title: course.title,
  };
}

/** Counts all matching courses but loads progress only for the most recent few. */
export async function lookUpCourses({
  goal,
  query,
  scope,
}: Lookup): Promise<GoalTutorLookUpResult> {
  const what = "courses";
  const studied = (await listCurrentUserCourses()) ?? [];

  const courses = studied.filter((course) => !query || matchesQuery({ query, text: course.title }));

  if (courses.length === 0) {
    return { status: "notFound", what };
  }

  return {
    courses: await Promise.all(
      courses.slice(0, MAX_COURSES).map((course) => toCourse({ course, goal })),
    ),
    link: toPageLink({ page: "courses", scope }),
    moreCourses: Math.max(0, courses.length - MAX_COURSES),
    status: "found",
    what,
  };
}
