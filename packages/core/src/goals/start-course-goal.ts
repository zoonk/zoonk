import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { findPublishedCourseEditions } from "../courses/list-published-course-editions";
import { getExamCalendarDay, getPlanExamDays } from "../exams/_utils/plan-exam-days";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { DEFAULT_DAILY_MINUTES } from "../plans/daily-minutes";
import { fromIsoDate, toIsoDate } from "../plans/planner/plan-calendar";
import { getTargetDateBounds } from "../plans/target-date-range";
import { getSession } from "../users/get-session";
import { getOnboarding } from "../view-models/onboarding/get-onboarding";
import { hasOnboardingQuestions } from "../view-models/onboarding/onboarding-steps";
import { loadCourseExam } from "./_utils/course-exam";
import { getCourseGoalKind } from "./_utils/course-goal-kind";
import { loadCourseOutline } from "./_utils/course-outline";
import { type CourseGoalLookup, findCourseGoal } from "./_utils/find-course-goal";
import { type CourseGoalStartInput } from "./course-start-contract";
import { type CourseStart } from "./course-start-details";
import { type GoalRefusal, createGoals } from "./create-goals";
import { type GoalDraft, type GoalView } from "./goal-contract";
import { resolveCourseStartLanguage } from "./resolve-course-start-language";

export type CourseGoalStartResult =
  | { goal: GoalView; status: "created" }
  | { goal: GoalView; inOnboarding: boolean; status: "existing" }
  | { refusals: GoalRefusal[]; status: "refused" }
  | { status: "notFound" | "unauthorized" };

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

async function resolveStart({
  courseId,
  language,
  userId,
}: {
  courseId: string;
  language?: string;
  userId: string;
}) {
  const source = isUuid(courseId) ? await findStartableCourse({ courseId, userId }) : null;

  if (!source) {
    return null;
  }

  const initial = resolveCourseStartLanguage({ course: { ...source, editions: [] }, language });

  if (initial.kind === "same") {
    return {
      course: source,
      lookup: { primaryCourseId: courseId, sourceCourseId: courseId },
      same: true,
    };
  }

  const editions = source.familyId ? await findPublishedCourseEditions(source.familyId) : [];
  const decision = resolveCourseStartLanguage({ course: { ...source, editions }, language });

  const edition =
    decision.kind === "edition"
      ? await findStartableCourse({ courseId: decision.edition.id, userId })
      : null;

  const lookup: CourseGoalLookup = {
    language: initial.language,
    primaryCourseId: edition?.id,
    sourceCourseId: courseId,
  };

  return { course: edition ?? source, lookup, same: false };
}

async function toExistingResult(goalId: string): Promise<CourseGoalStartResult> {
  const result = await getOnboarding({ goalId });

  if (result.status !== "ready") {
    return result;
  }

  const { goal, steps } = result.onboarding;
  return { goal, inOnboarding: hasOnboardingQuestions(steps), status: "existing" };
}

export async function findCourseGoalStart(
  courseId: string,
  language?: string,
): Promise<{ goalId: string; inOnboarding: boolean } | null> {
  const session = await getSession();

  if (!session || !isUuid(courseId)) {
    return null;
  }

  const userId = session.user.id;

  const start =
    language === undefined
      ? { lookup: { primaryCourseId: courseId, sourceCourseId: courseId } }
      : await resolveStart({ courseId, language, userId });

  const goal = start ? await findCourseGoal(prisma, { ...start.lookup, userId }) : null;

  if (!goal) {
    return null;
  }

  const existing = await toExistingResult(goal.id);

  return existing.status === "existing"
    ? { goalId: goal.id, inOnboarding: existing.inOnboarding }
    : null;
}

function toCourseGoalDraft({
  course,
  lookup,
  examBlueprintId,
  input,
}: {
  course: NonNullable<Awaited<ReturnType<typeof findStartableCourse>>>;
  lookup: CourseGoalLookup;
  examBlueprintId: string | undefined;
  input: CourseGoalStartInput;
}): GoalDraft {
  const answered = [
    input.targetDate !== undefined && "targetDate",
    input.level !== undefined && "level",
  ].filter(Boolean);

  return {
    details: {
      ...(answered.length > 0 && { answered }),
      ...(input.level && { level: input.level }),
    },
    displayName: course.title,
    examBlueprintId,
    kind: getCourseGoalKind({
      format: course.format,
      hasExam: Boolean(examBlueprintId),
      targetLanguage: course.targetLanguage,
    }),
    language: lookup.primaryCourseId ? course.language : (lookup.language ?? course.language),
    primaryCourseId: lookup.primaryCourseId,
    prompt: course.title,
    targetDate: input.targetDate ?? undefined,
    targetLanguage: course.targetLanguage ?? undefined,
    title: course.title,
  };
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
  goal: GoalView;
  input: CourseGoalStartInput;
  userId: string;
}): Promise<GoalView> {
  const day =
    goal.kind === "exam" && input.targetDate === undefined ? findDefaultExamDay(exam) : null;

  const timeZone = getAnswerTimeZone({ goal: null, timeZone: input.timeZone });
  const today = toIsoDate(getDateInTimeZone({ date: new Date(), timeZone }));

  if (!day || day > getTargetDateBounds(today).max) {
    return goal;
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

  return { ...goal, targetDate: day };
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
  const start = await resolveStart({ courseId, language: input.language, userId });

  if (!start) {
    return { status: "notFound" };
  }

  const { course, lookup, same } = start;
  const chapterId = same ? (input.chapterId ?? null) : null;

  const [existing, outline, exam] = await Promise.all([
    findCourseGoal(prisma, { ...lookup, userId }),
    chapterId ? loadCourseOutline({ courseId: course.id, userId }) : [],
    loadCourseExam(course.id),
  ]);

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

  const created = await createGoals(
    {
      dailyMinutes: input.dailyMinutes ?? DEFAULT_DAILY_MINUTES,
      goals: [toCourseGoalDraft({ course, examBlueprintId: exam?.blueprint.id, input, lookup })],
      studyDays: input.studyDays,
      studyTime: input.studyTime,
      timeZone: input.timeZone,
    },
    { details: courseStart, lookup },
  );

  if (created.status === "existing") {
    return toExistingResult(created.goalId);
  }

  if (created.status === "refused") {
    return { refusals: created.refused, status: "refused" };
  }

  const [goal] = created.status === "created" ? created.goals : [];

  if (!goal) {
    return { status: created.status === "unauthorized" ? "unauthorized" : "notFound" };
  }

  return { goal: await setDefaultExamDate({ exam, goal, input, userId }), status: "created" };
}
