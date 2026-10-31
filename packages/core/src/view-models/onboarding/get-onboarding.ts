import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { searchCourses } from "../../courses/search-courses";
import { getNoSitting } from "../../exams/_utils/notice-day";
import { getExamCalendarDay, getPlanExamDays } from "../../exams/_utils/plan-exam-days";
import { listExamChoiceViews } from "../../exams/choices/exam-choice-views";
import { toChosenStructure } from "../../exams/choices/exam-choices";
import { loadExamChoices } from "../../exams/choices/load-exam-choices";
import { findNamedChoices } from "../../exams/choices/named-exam-choices";
import { isWrittenSubject } from "../../exams/mocks/written-subject";
import { loadCourseExam } from "../../goals/_utils/course-exam";
import { findActiveGoalId, loadGoalViews } from "../../goals/_utils/goal-view";
import { readCourseStart } from "../../goals/course-start-details";
import { getDaySplit } from "../../goals/daily-budget";
import { getQuickTestMinutes } from "../../language/level-test/level-test-contract";
import { findOwnedGoal, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { examStructureSchema } from "../../library/exams/blueprint-contract";
import { readPlanReadiness } from "../../plans/_utils/plan-readiness";
import { DAILY_TIME_CHOICES } from "../../plans/daily-minutes";
import { type NoSitting } from "../../plans/plan-view-contract";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { findLearningProfileView } from "../../profile/_utils/learning-profile-view";
import { findOnboardingGoalIds } from "./_utils/onboarding-goals";
import { getGoalSize, getRecommendedMinutes } from "./_utils/recommended-minutes";
import {
  ONBOARDING_QUESTIONS,
  type OnboardingDateProblem,
  type OnboardingLibraryCourse,
  type OnboardingStep,
  type OnboardingView,
} from "./onboarding-contract";
import {
  getFollowUpQuestions,
  getOnboardingSteps,
  isClassTest,
  isCourseDateSkipped,
} from "./onboarding-steps";

export type OnboardingResult =
  | { onboarding: OnboardingView; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/** Before a POST saves it, an option the learner's own words name already counts as picked, so only a choice nothing names is asked. */
async function findExamNotice({
  details,
  goal,
  goalDate,
  today,
}: {
  details: Record<string, unknown>;
  goal: Pick<Goal, "details" | "examBlueprintId" | "id" | "language" | "prompt" | "title">;
  goalDate: string | null;
  today: string;
}): Promise<{
  choices: OnboardingView["examChoices"];
  examDate: string | null;
  examDays: OnboardingView["examDays"];
  fromMaterial: boolean;
  hasUnpickedChoice: boolean;
  noSitting: NoSitting | null;
  subjects: OnboardingView["examSubjects"];
}> {
  if (!goal.examBlueprintId) {
    return {
      choices: [],
      examDate: null,
      examDays: null,
      fromMaterial: false,
      hasUnpickedChoice: false,
      noSitting: null,
      subjects: [],
    };
  }

  const [blueprint, saved] = await Promise.all([
    prisma.examBlueprint.findUnique({
      select: { edition: true, examDate: true, ownerId: true, structure: true },
      where: { id: goal.examBlueprintId },
    }),
    loadExamChoices(goal.id),
  ]);

  const stored = examStructureSchema.safeParse(blueprint?.structure).data;

  const choices = stored
    ? [...saved, ...findNamedChoices({ choices: saved, goal, structure: stored })]
    : saved;

  const structure = stored && toChosenStructure({ choices, structure: stored });

  // Written papers are not subjects the learner can declare already known.
  const subjects = structure
    ? structure.subjects.filter((subject) => !isWrittenSubject({ structure, subject }))
    : [];

  const views = stored ? listExamChoiceViews({ choices, structure: stored }) : [];

  return {
    choices: views,
    examDate: blueprint?.examDate ? toIsoDate(blueprint.examDate) : null,
    examDays:
      blueprint && !blueprint.ownerId
        ? getNextSittingDays({ edition: blueprint.edition, today })
        : null,
    fromMaterial: Boolean(blueprint?.ownerId),
    hasUnpickedChoice: views.some((choice) => choice.subject === null),
    noSitting: getNoSitting({ blueprint, details, goalDate, today }),
    subjects: subjects.map((subject) => ({
      name: subject.name,
      shortName: subject.shortName ?? null,
    })),
  };
}

/** After both the exam's day and the learner's, so the sitting offered can still be planned for. */
function getNextSittingDays({
  edition,
  today,
}: {
  edition: unknown;
  today: string;
}): OnboardingView["examDays"] {
  const examDay = getExamCalendarDay({ edition, now: new Date() }).today;
  const from = examDay > today ? examDay : today;
  const found = getPlanExamDays({ details: {}, edition, goalDate: null, today: from });

  return found.days.length > 0
    ? { days: found.days.map((day) => day.date), estimated: found.estimated }
    : null;
}

async function findCourseExamDays({
  goal,
  today,
}: {
  goal: { kind: string; primaryCourseId: string | null };
  today: string;
}): Promise<OnboardingView["examDays"]> {
  const exam =
    goal.kind === "exam" && goal.primaryCourseId
      ? await loadCourseExam(goal.primaryCourseId)
      : null;

  return exam ? getNextSittingDays({ edition: exam.blueprint.edition, today }) : null;
}

function getDateProblem({
  goalDate,
  noSitting,
  today,
}: {
  goalDate: string | null;
  noSitting: NoSitting | null;
  today: string;
}): OnboardingDateProblem | null {
  if (goalDate === today) {
    return { kind: "today" };
  }

  if (goalDate !== null && goalDate < today) {
    return { kind: "passed" };
  }

  return noSitting ? { kind: "noSitting", ...noSitting } : null;
}

const QUESTIONS = new Set<OnboardingStep>(ONBOARDING_QUESTIONS);

const COURSE_KINDS = new Set(["exam", "learn"]);

/** Match published courses in the learner's language again after answers may have narrowed the subject. */
async function findLibraryCourse({
  goal,
  steps,
  subject,
}: {
  goal: { kind: string; language: string };
  steps: OnboardingStep[];
  subject: string;
}): Promise<OnboardingLibraryCourse | null> {
  if (!COURSE_KINDS.has(goal.kind) || steps.some((step) => QUESTIONS.has(step))) {
    return null;
  }

  const [course] = await searchCourses({
    filterByLanguage: true,
    language: goal.language,
    limit: 1,
    query: subject,
  });

  if (!course) {
    return null;
  }

  const chapterCount = await prisma.courseChapter.count({ where: { courseId: course.id } });

  return {
    brandSlug: course.organization.slug,
    chapterCount,
    courseId: course.id,
    courseSlug: course.slug,
    title: course.title,
  };
}

/** Requires ownership; uncached so every answer immediately changes the remaining screens. */
export async function getOnboarding({ goalId }: { goalId: string }): Promise<OnboardingResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;
  const details = isJsonObject(goal.details) ? goal.details : {};
  const goalDate = goal.targetDate ? toIsoDate(goal.targetDate) : null;

  const today = toIsoDate(
    getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) }),
  );

  const [profile, activeGoalId, goalIds, notice, courseExamDays, planReadiness] = await Promise.all(
    [
      findLearningProfileView(userId),
      findActiveGoalId(userId),
      findOnboardingGoalIds(goal),
      findExamNotice({ details, goal, goalDate, today }),
      findCourseExamDays({ goal, today }),
      readPlanReadiness(goal.id),
    ],
  );

  const [earlierGoals, [view]] = await Promise.all([
    prisma.goal.count({ where: { id: { notIn: goalIds }, userId } }),
    loadGoalViews({ activeGoalId, goals: [goal] }),
  ]);

  if (!view) {
    return { status: "notFound" };
  }

  const dateProblem = getDateProblem({ goalDate, noSitting: notice.noSitting, today });

  const steps = getOnboardingSteps({
    goal: {
      dateProblem: dateProblem?.kind ?? null,
      details,
      hasUnpickedChoice: notice.hasUnpickedChoice,
      kind: goal.kind,
      targetDate: view.targetDate,
    },
    profile: { hasBuddy: profile.buddy.picked, hasEarlierGoals: earlierGoals > 0 },
  });

  const courseStart = readCourseStart(details);

  const libraryCourse = courseStart
    ? null
    : await findLibraryCourse({
        goal,
        steps,
        subject:
          typeof details.subject === "string" && details.subject ? details.subject : goal.title,
      });

  const targetDate = isCourseDateSkipped({ details, targetDate: view.targetDate })
    ? null
    : (view.targetDate ?? notice.examDate);

  // The time a day the course's page had picked stays the learner's until they change it.
  const recommendedMinutes =
    courseStart?.dailyMinutes ??
    getRecommendedMinutes({
      size: getGoalSize({
        hasNotice: goal.examBlueprintId !== null && !notice.fromMaterial,
        isClassTest: isClassTest(details) || notice.fromMaterial,
        kind: goal.kind,
        purpose: details.purpose,
        targetDate,
        targetPosition: details.targetPosition,
        today,
      }),
      targetDate,
      today,
    });

  return {
    onboarding: {
      dateProblem,
      examChoices: notice.choices,
      examDays: courseExamDays ?? notice.examDays,
      examSubjects: notice.subjects,
      followUps: getFollowUpQuestions(details),
      generationId: goal.generationRunId,
      goal: view,
      goalIds,
      libraryCourse,
      planReadiness: planReadiness ?? { readingNotice: false, ready: false },
      quickTestMinutes: getQuickTestMinutes(goal.kind),
      recommendedMinutes,
      steps,
      timeChoices: [...new Set([...DAILY_TIME_CHOICES, recommendedMinutes])]
        .toSorted((a, b) => a - b)
        .map((minutes) => ({
          minutes,
          split: getDaySplit({
            budget: minutes,
            count: goalIds.length,
            place: Math.max(0, goalIds.indexOf(goal.id)),
          }),
        })),
    },
    status: "ready",
  };
}
