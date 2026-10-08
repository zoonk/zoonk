import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { searchCourses } from "../../courses/search-courses";
import { isWrittenSubject } from "../../exams/mocks/written-subject";
import { findActiveGoalId, loadGoalViews } from "../../goals/_utils/goal-view";
import { readCourseStart } from "../../goals/course-start-details";
import { findOwnedGoal, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { examStructureSchema } from "../../library/exams/blueprint-contract";
import { asksToTurnOnMemory, getMemoryAccess } from "../../memory/_utils/memory-access";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { findLearningProfileView } from "../../profile/_utils/learning-profile-view";
import { getGoalSize, getRecommendedMinutes } from "./_utils/recommended-minutes";
import {
  ONBOARDING_QUESTIONS,
  type OnboardingLibraryCourse,
  type OnboardingStep,
  type OnboardingView,
} from "./onboarding-contract";
import { getFollowUpQuestions, getOnboardingSteps, isClassTest } from "./onboarding-steps";

export type OnboardingResult =
  | { onboarding: OnboardingView; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/** Goals typed together ("ENEM and English") share an onboarding id and the day's time. */
async function findOnboardingGoalIds({
  details,
  goalId,
  userId,
}: {
  details: Record<string, unknown>;
  goalId: string;
  userId: string;
}): Promise<string[]> {
  const onboardingId = details.onboardingId;

  if (typeof onboardingId !== "string") {
    return [goalId];
  }

  const goals = await prisma.goal.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true },
    where: { details: { equals: onboardingId, path: ["onboardingId"] }, userId },
  });

  return goals.length > 0 ? goals.map((goal) => goal.id) : [goalId];
}

/**
 * What the exam's stored notice says that onboarding uses: its subjects, for the count before
 * placement, its exam day, for the time question's starting pick when the goal has no date of
 * its own, and whether it's the learner's own material read into a notice (`fromMaterial`, a
 * class test).
 */
async function findExamNotice(
  examBlueprintId: string | null,
): Promise<{
  examDate: string | null;
  fromMaterial: boolean;
  subjects: OnboardingView["examSubjects"];
}> {
  if (!examBlueprintId) {
    return { examDate: null, fromMaterial: false, subjects: [] };
  }

  const blueprint = await prisma.examBlueprint.findUnique({
    select: { examDate: true, ownerId: true, structure: true },
    where: { id: examBlueprintId },
  });

  const structure = examStructureSchema.safeParse(blueprint?.structure).data;

  // Its written tests (a discursive test, an essay) aren't subjects a learner already knows well.
  const subjects = structure
    ? structure.subjects.filter((subject) => !isWrittenSubject({ structure, subject }))
    : [];

  return {
    examDate: blueprint?.examDate ? toIsoDate(blueprint.examDate) : null,
    fromMaterial: Boolean(blueprint?.ownerId),
    subjects: subjects.map((subject) => ({
      name: subject.name,
      shortName: subject.shortName ?? null,
    })),
  };
}

const QUESTIONS = new Set<OnboardingStep>(ONBOARDING_QUESTIONS);

/** Goals the Library can already teach: a subject or an exam, not a language pair. */
const COURSE_KINDS = new Set(["exam", "learn"]);

/**
 * A published Library course that already teaches the goal's subject, in the learner's language:
 * the course whose title is the subject, else the first whose title contains it. It's looked for
 * again once every question is answered, since the answers may have narrowed the subject since the
 * goal was typed.
 */
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
    courseSlug: course.slug,
    title: course.title,
  };
}

/**
 * The rest of onboarding for a goal the learner just created: the goal, the screens still ahead
 * (only unanswered questions, then age, memory and buddy when the profile lacks them, placement and
 * the plan) and whether they're a minor. Uncached: every answer changes it.
 */
export async function getOnboarding({ goalId }: { goalId: string }): Promise<OnboardingResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;
  const details = isJsonObject(goal.details) ? goal.details : {};

  const [profile, memory, activeGoalId, goalIds, notice] = await Promise.all([
    findLearningProfileView(userId),
    getMemoryAccess(userId),
    findActiveGoalId(userId),
    findOnboardingGoalIds({ details, goalId, userId }),
    findExamNotice(goal.examBlueprintId),
  ]);

  const earlierGoals = await prisma.goal.count({ where: { id: { notIn: goalIds }, userId } });

  const [view] = await loadGoalViews({ activeGoalId, goals: [goal] });

  if (!view) {
    return { status: "notFound" };
  }

  const steps = getOnboardingSteps({
    goal: { details, kind: goal.kind, targetDate: view.targetDate },
    profile: {
      asksMemory: asksToTurnOnMemory(memory),
      hasBirth: profile.birth !== null,
      hasBuddy: profile.buddy !== null,
      hasEarlierGoals: earlierGoals > 0,
    },
  });

  const today = toIsoDate(
    getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) }),
  );

  // A goal started from a course's page is already built from that course.
  const libraryCourse = readCourseStart(details)
    ? null
    : await findLibraryCourse({
        goal,
        steps,
        subject:
          typeof details.subject === "string" && details.subject ? details.subject : goal.title,
      });

  return {
    onboarding: {
      examSubjects: notice.subjects,
      followUps: getFollowUpQuestions(details),
      generationId: goal.generationRunId,
      goal: view,
      goalIds,
      isMinor: profile.ageGroup === "teen",
      libraryCourse,
      recommendedMinutes: getRecommendedMinutes({
        size: getGoalSize({
          hasNotice: goal.examBlueprintId !== null && !notice.fromMaterial,
          isClassTest: isClassTest(details) || notice.fromMaterial,
          kind: goal.kind,
          purpose: details.purpose,
          targetDate: view.targetDate ?? notice.examDate,
          targetPosition: details.targetPosition,
          today,
        }),
        targetDate: view.targetDate ?? notice.examDate,
        today,
      }),
      steps,
    },
    status: "ready",
  };
}
