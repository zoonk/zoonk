import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { searchCourses } from "../../courses/search-courses";
import { findActiveGoalId, loadGoalViews } from "../../goals/_utils/goal-view";
import { readCourseStart } from "../../goals/course-start-details";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { examStructureSchema } from "../../library/exams/blueprint-contract";
import { findLearningProfileView } from "../../profile/_utils/learning-profile-view";
import {
  ONBOARDING_QUESTIONS,
  type OnboardingLibraryCourse,
  type OnboardingStep,
  type OnboardingView,
} from "./onboarding-contract";
import { getFollowUpQuestions, getOnboardingSteps } from "./onboarding-steps";

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

/** The exam's subjects from its stored notice, for the tiles before placement. */
async function findExamSubjects(examBlueprintId: string | null): Promise<string[]> {
  if (!examBlueprintId) {
    return [];
  }

  const blueprint = await prisma.examBlueprint.findUnique({
    select: { structure: true },
    where: { id: examBlueprintId },
  });

  const subjects = examStructureSchema.safeParse(blueprint?.structure).data?.subjects ?? [];
  return subjects.map((subject) => subject.name);
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
 * (only unanswered questions, then age, mode and buddy when the profile lacks them, placement and
 * the plan) and whether they're a minor. Uncached: every answer changes it.
 */
export async function getOnboarding({ goalId }: { goalId: string }): Promise<OnboardingResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;
  const details = isJsonObject(goal.details) ? goal.details : {};

  const [profile, activeGoalId, goalIds, examSubjects] = await Promise.all([
    findLearningProfileView(userId),
    findActiveGoalId(userId),
    findOnboardingGoalIds({ details, goalId, userId }),
    findExamSubjects(goal.examBlueprintId),
  ]);

  const earlierGoals = await prisma.goal.count({ where: { id: { notIn: goalIds }, userId } });

  const [view] = await loadGoalViews({ activeGoalId, goals: [goal] });

  if (!view) {
    return { status: "notFound" };
  }

  const steps = getOnboardingSteps({
    goal: { details, kind: goal.kind, targetDate: view.targetDate },
    profile: {
      experienceMode: profile.experienceMode,
      hasBirth: profile.birth !== null,
      hasBuddy: profile.buddy !== null,
      hasEarlierGoals: earlierGoals > 0,
    },
  });

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
      examSubjects,
      followUps: getFollowUpQuestions(details),
      generationId: goal.generationRunId,
      goal: view,
      goalIds,
      isMinor: profile.ageGroup === "teen",
      libraryCourse,
      steps,
    },
    status: "ready",
  };
}
