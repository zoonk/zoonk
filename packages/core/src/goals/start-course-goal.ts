import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { getExamCalendarDay, getPlanExamDays } from "../exams/_utils/plan-exam-days";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { createGoalPlan } from "../plans/create-goal-plan";
import { fromIsoDate, toIsoDate } from "../plans/planner/plan-calendar";
import { getTargetDateBounds } from "../plans/target-date-range";
import { getSession } from "../users/get-session";
import { answerOnboardingQuestion } from "../view-models/onboarding/answer-onboarding-question";
import { getOnboarding } from "../view-models/onboarding/get-onboarding";
import { loadCourseExam } from "./_utils/course-exam";
import { getCourseGoalKind } from "./_utils/course-goal-kind";
import { loadCourseOutline, plansFromCourseOutline } from "./_utils/course-outline";
import { toCoursePlanGraph } from "./_utils/course-plan-graph";
import { findActiveGoalId, loadGoalViews } from "./_utils/goal-view";
import { type CourseGoalStartInput } from "./course-start-contract";
import { type CourseStart } from "./course-start-details";
import { type GoalRefusal, createGoals } from "./create-goals";
import { type GoalDraft, type GoalView } from "./goal-contract";

export type CourseGoalStartResult =
  | { goal: GoalView; status: "created" }
  | { goal: GoalView; inOnboarding: boolean; status: "existing" }
  | { refusals: GoalRefusal[]; status: "refused" }
  | { status: "notFound" | "unauthorized" };

const DEFAULT_DAILY_MINUTES = 15;

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

function findCourseGoal({ courseId, userId }: { courseId: string; userId: string }) {
  return prisma.goal.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true },
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

export async function findCourseGoalStart(
  courseId: string,
): Promise<{ goalId: string; inOnboarding: boolean } | null> {
  const session = await getSession();

  const goal =
    session && isUuid(courseId)
      ? await findCourseGoal({ courseId, userId: session.user.id })
      : null;

  if (!goal) {
    return null;
  }

  const existing = await toExistingResult(goal.id);

  return existing.status === "existing"
    ? { goalId: goal.id, inOnboarding: existing.inOnboarding }
    : null;
}

export async function hasCourseGoal(courseId: string): Promise<boolean> {
  const session = await getSession();

  if (!session || !isUuid(courseId)) {
    return false;
  }

  return (await findCourseGoal({ courseId, userId: session.user.id })) !== null;
}

async function loadGoalView({ goal, userId }: { goal: GoalView; userId: string }) {
  const [row, activeGoalId] = await Promise.all([
    prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
    findActiveGoalId(userId),
  ]);

  const [view] = await loadGoalViews({ activeGoalId, goals: [row] });
  return view ?? goal;
}

function toCourseGoalDraft({
  course,
  courseStart,
  examBlueprintId,
  input,
}: {
  course: NonNullable<Awaited<ReturnType<typeof findStartableCourse>>>;
  courseStart: CourseStart;
  examBlueprintId: string | undefined;
  input: CourseGoalStartInput;
}): GoalDraft {
  return {
    details: {
      ...(input.targetDate === undefined ? {} : { answered: ["targetDate"] }),
      courseStart,
    },
    examBlueprintId,
    kind: getCourseGoalKind({
      format: course.format,
      hasExam: Boolean(examBlueprintId),
      targetLanguage: course.targetLanguage,
    }),
    language: course.language,
    primaryCourseId: course.id,
    prompt: course.title,
    targetDate: input.targetDate ?? undefined,
    targetLanguage: course.targetLanguage ?? undefined,
    title: course.title,
  };
}

async function planFromOutline({
  chapterId,
  course,
  exam,
  goalId,
  outline,
}: {
  chapterId: string | null;
  course: NonNullable<Awaited<ReturnType<typeof findStartableCourse>>>;
  exam: Awaited<ReturnType<typeof loadCourseExam>>;
  goalId: string;
  outline: Awaited<ReturnType<typeof loadCourseOutline>>;
}): Promise<void> {
  const graph = toCoursePlanGraph({
    chapters: outline,
    course,
    examGraph: exam?.graph,
    startChapterId: chapterId,
  });

  if (graph.skills.length > 0 || exam) {
    await createGoalPlan({ goalId, graph });
  }
}

function findDefaultExamDay(exam: Awaited<ReturnType<typeof loadCourseExam>>): string | null {
  if (!exam) {
    return null;
  }

  const { edition } = exam.blueprint;
  const { today } = getExamCalendarDay({ edition, now: new Date() });

  return getPlanExamDays({ details: {}, edition, goalDate: null, today }).days[0]?.date ?? null;
}

async function setDefaultExamDate({
  exam,
  goal,
  input,
  userId,
}: {
  exam: Awaited<ReturnType<typeof loadCourseExam>>;
  goal: Pick<GoalView, "id" | "kind">;
  input: CourseGoalStartInput;
  userId: string;
}): Promise<void> {
  const day =
    goal.kind === "exam" && input.targetDate === undefined ? findDefaultExamDay(exam) : null;

  const timeZone = getAnswerTimeZone({ goal: null, timeZone: input.timeZone });
  const today = toIsoDate(getDateInTimeZone({ date: new Date(), timeZone }));

  if (!day || day > getTargetDateBounds(today).max) {
    return;
  }

  const goalId = goal.id;

  await writeLearnerChange({ planInputs: true, userId }, async (tx) => {
    const [current, plan] = await Promise.all([
      tx.goal.findUniqueOrThrow({ where: { id: goalId } }),
      tx.plan.findUniqueOrThrow({ where: { goalId } }),
    ]);

    const settings = isJsonObject(plan.settings) ? plan.settings : {};
    const targetDate = fromIsoDate(day);

    if (current.targetDate?.getTime() === targetDate.getTime() && settings.noticeDate === day) {
      return unchanged(null);
    }

    await tx.goal.update({ data: { targetDate }, where: { id: goalId } });

    await tx.plan.update({
      data: { settings: { ...settings, noticeDate: day } },
      where: { goalId },
    });
  });
}

/**
 * Guests can start one. It counts against the goal limits, and the learner's goal already on the
 * course comes back instead of a second one.
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

  const [existing, outline, exam] = await Promise.all([
    findCourseGoal({ courseId, userId }),
    loadCourseOutline({ courseId, userId }),
    loadCourseExam(courseId),
  ]);

  const chapterId = input.chapterId ?? null;

  if (chapterId && !outline.some((chapter) => chapter.chapterId === chapterId)) {
    return { status: "notFound" };
  }

  if (existing) {
    return toExistingResult(existing.id);
  }

  const courseStart: CourseStart = {
    chapterId,
    ...(input.dailyMinutes !== undefined && { dailyMinutes: input.dailyMinutes }),
  };

  const created = await createGoals({
    dailyMinutes: input.dailyMinutes ?? DEFAULT_DAILY_MINUTES,
    goals: [toCourseGoalDraft({ course, courseStart, examBlueprintId: exam?.blueprint.id, input })],
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

  await setDefaultExamDate({ exam, goal, input, userId });

  if (input.level !== undefined) {
    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { level: input.level, question: "level" },
    });
  }

  const plansFromOutline = plansFromCourseOutline({
    chapterId,
    chapters: outline,
    courseFormat: course.format,
    courseId: course.id,
    examGraph: exam?.graph ?? null,
    outlineStatus: course.outlineStatus,
  });

  if (plansFromOutline) {
    await planFromOutline({ chapterId, course, exam, goalId: goal.id, outline });
  }

  return { goal: await loadGoalView({ goal, userId }), status: "created" };
}
