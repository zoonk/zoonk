import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { getExamCalendarDay, getPlanExamDays } from "../exams/_utils/plan-exam-days";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
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

/**
 * The learner's goal already following this course, with whether its onboarding still has
 * screens to show, so the course's start page sends them back to it instead of asking their level
 * again. Null without one or without a session.
 */
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

/**
 * Whether the signed-in learner has a goal following this course, so the course's public page
 * says "Continue your plan": its start page sends them back to that goal. One read, without the
 * onboarding `findCourseGoalStart` adds; false without a session.
 */
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

/**
 * The plan of a goal started from a course, from the course's own outline. The planner resolves
 * an omitted exam date through getExamEditionDays/findMeantExamDay and retains noticeDate, so later
 * notice readings can follow it without overriding a supplied date.
 */
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

/**
 * The day an exam course's start counts down to until the learner says otherwise: its exam's next
 * day in the exam's own zone, from the source the course page (`getCourseExamDays`) and the plan
 * (`createGoalPlan`) read. Null without an exam or a day of it.
 */
function findDefaultExamDay(exam: Awaited<ReturnType<typeof loadCourseExam>>): string | null {
  if (!exam) {
    return null;
  }

  const { edition } = exam.blueprint;
  const { today } = getExamCalendarDay({ edition, now: new Date() });

  return getPlanExamDays({ details: {}, edition, goalDate: null, today }).days[0]?.date ?? null;
}

/**
 * Gives a new exam goal its exam's day, kept as the notice's (`noticeDate`), not as an answer:
 * onboarding still asks to keep, change or remove it, and a revised notice still moves it (see
 * `createGoalPlan`). A start whose plan waits for the goal's first run counts down from the
 * start, as one planned from the course's outline does.
 */
async function setDefaultExamDate({
  exam,
  goal,
  input,
}: {
  exam: Awaited<ReturnType<typeof loadCourseExam>>;
  goal: Pick<GoalView, "id" | "kind">;
  input: CourseGoalStartInput;
}): Promise<void> {
  // A date the learner gave, or their "no date", is theirs.
  const day =
    goal.kind === "exam" && input.targetDate === undefined ? findDefaultExamDay(exam) : null;

  const timeZone = getAnswerTimeZone({ goal: null, timeZone: input.timeZone });
  const today = toIsoDate(getDateInTimeZone({ date: new Date(), timeZone }));

  // A day past what a plan reaches can't be the plan's date: onboarding asks for one instead.
  if (!day || day > getTargetDateBounds(today).max) {
    return;
  }

  const goalId = goal.id;

  const plan = await prisma.plan.findUniqueOrThrow({
    select: { settings: true },
    where: { goalId },
  });

  const settings = isJsonObject(plan.settings) ? plan.settings : {};

  await prisma.$transaction([
    prisma.goal.update({ data: { targetDate: fromIsoDate(day) }, where: { id: goalId } }),
    prisma.plan.update({ data: { settings: { ...settings, noticeDate: day } }, where: { goalId } }),
  ]);
}

/**
 * Starts a Library course (or one of its chapters) as the learner's goal, with nothing to type or
 * confirm: a learn goal on the course, a language goal for a language course, or an exam goal
 * when the course links to a stored public exam or is an exam course, with its plan built from the
 * course's own outline right away when that outline covers what the course spans (every level of
 * its path to mastery, or every skill its stored exam gives it), or the learner picked a chapter to
 * start at. Onboarding then asks only what still matters: the learner's level (unless the start
 * page asked it), an optional date (unless supplied or given by the exam's notice), placement
 * (a language's level test), their time, and the profile screens.
 * It counts against the plan's goal limits like any new goal; the learner's goal already on that
 * course comes back instead of a second one. A course outlined only in part (or not at all) gets
 * the plan from the goal's first run, like a typed goal: its graph, pinned to this course, names
 * the levels this learner needs and outlines the ones the course lacks, while onboarding asks its
 * questions. Guests can start one.
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

  await setDefaultExamDate({ exam, goal, input });

  // The level the start page asked is onboarding's answer, saved as its own screen saves it.
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
