import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getSession } from "../users/get-session";
import { getOnboarding } from "../view-models/onboarding/get-onboarding";
import { loadCourseOutline } from "./_utils/course-outline";
import { toCoursePlanGraph } from "./_utils/course-plan-graph";
import { findActiveGoalId, loadGoalViews } from "./_utils/goal-view";
import { type CourseGoalStartInput } from "./course-start-contract";
import { type CourseStart } from "./course-start-details";
import { type GoalRefusal, createGoals } from "./create-goals";
import { type GoalView } from "./goal-contract";

export type CourseGoalStartResult =
  | { goal: GoalView; status: "created" }
  /** The learner's goal on this course, and whether its onboarding still has screens to show. */
  | { goal: GoalView; inOnboarding: boolean; status: "existing" }
  | { refusals: GoalRefusal[]; status: "refused" }
  | { status: "notFound" | "unauthorized" };

/** What onboarding suggests when nobody said how much time they have; its schedule screen asks. */
const DEFAULT_DAILY_MINUTES = 15;

/** A published public course, or the learner's own private one: nobody else can start that. */
function findStartableCourse({ courseId, userId }: { courseId: string; userId: string }) {
  return prisma.course.findFirst({
    omit: { landingPage: true },
    where: {
      OR: [
        { isPublished: true, visibility: "public" },
        { userId, visibility: "private" },
      ],
      id: courseId,
    },
  });
}

/** The learner's goal already following this course, the newest first; questions aside. */
function findCourseGoal({ courseId, userId }: { courseId: string; userId: string }) {
  return prisma.goal.findFirst({
    orderBy: { createdAt: "desc" },
    where: { kind: { not: "explain" }, primaryCourseId: courseId, status: "active", userId },
  });
}

async function toExistingResult(goalId: string): Promise<CourseGoalStartResult> {
  const result = await getOnboarding({ goalId });

  if (result.status !== "ready") {
    return result;
  }

  const { goal, steps } = result.onboarding;
  return { goal, inOnboarding: steps.some((step) => step !== "plan"), status: "existing" };
}

async function loadGoalView({ goal, userId }: { goal: GoalView; userId: string }) {
  const [row, activeGoalId] = await Promise.all([
    prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
    findActiveGoalId(userId),
  ]);

  const [view] = await loadGoalViews({ activeGoalId, goals: [row] });
  return view ?? goal;
}

/**
 * Starts a Library course (or one of its chapters) as the learner's goal, with nothing to type or
 * confirm: a learn goal on the course, or a language goal for a language course, with its plan
 * built from the course's own outline right away (the plan starts at the chapter when one was
 * picked). Onboarding then asks only what still matters: the learner's level and placement (a
 * language's level test), their time, and the profile screens. It counts against the plan's goal
 * limits like any new goal; the learner's goal already on that course comes back instead of a
 * second one. A course nobody outlined yet gets its plan from the goal's first run, like a typed
 * goal. Guests can start one.
 */
export async function startCourseGoal({
  courseId,
  input,
}: {
  courseId: string;
  input: CourseGoalStartInput;
}): Promise<CourseGoalStartResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const course = isUuid(courseId) ? await findStartableCourse({ courseId, userId }) : null;

  if (!course) {
    return { status: "notFound" };
  }

  const [existing, outline] = await Promise.all([
    findCourseGoal({ courseId, userId }),
    loadCourseOutline({ courseId, userId }),
  ]);

  const chapterId = input.chapterId ?? null;

  if (chapterId && !outline.some((chapter) => chapter.chapterId === chapterId)) {
    return { status: "notFound" };
  }

  if (existing) {
    return toExistingResult(existing.id);
  }

  const courseStart: CourseStart = { chapterId };

  const created = await createGoals({
    dailyMinutes: input.dailyMinutes ?? DEFAULT_DAILY_MINUTES,
    goals: [
      {
        details: { courseStart },
        kind: course.targetLanguage ? "language" : "learn",
        language: course.language,
        primaryCourseId: course.id,
        prompt: course.title,
        targetLanguage: course.targetLanguage ?? undefined,
        title: course.title,
      },
    ],
    studyDays: input.studyDays,
    studyTime: input.studyTime,
    timeZone: input.timeZone,
  });

  if (created.status === "refused") {
    return { refusals: created.refused, status: "refused" };
  }

  const [goal] = created.status === "created" ? created.goals : [];

  if (!goal) {
    return { status: created.status === "unauthorized" ? "unauthorized" : "notFound" };
  }

  const graph = toCoursePlanGraph({ chapters: outline, course, startChapterId: chapterId });

  if (graph.skills.length > 0) {
    await createGoalPlan({ goalId: goal.id, graph });
  }

  return { goal: await loadGoalView({ goal, userId }), status: "created" };
}
