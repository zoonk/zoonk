import { prisma } from "@zoonk/db";
import "server-only";
import { isJsonObject } from "@zoonk/utils/json";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { searchCourses } from "../../courses/search-courses";
import { findActiveGoalId, loadGoalViews } from "../../goals/_utils/goal-view";
import { readCourseStart } from "../../goals/course-start-details";
import { getDaySplit } from "../../goals/daily-budget";
import { readGoalOpening } from "../../goals/goal-opening";
import { LANGUAGE_REASON_VIEWS, toLanguageAimView } from "../../language/aims/language-aims";
import { getQuickTestMinutes } from "../../language/level-test/level-test-contract";
import { findOwnedGoal, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readLearningProfile } from "../../learner/facts/learning-profile";
import { readProfileQuestionState } from "../../learner/facts/profile-questions";
import { readRecentCountries } from "../../learner/facts/recent-countries";
import { readActiveSubscription } from "../../learner/facts/subscription";
import { readWarmUpState } from "../../library/warm-ups/claim-warm-up";
import { readPlanReadiness } from "../../plans/_utils/plan-readiness";
import { DAILY_TIME_CHOICES } from "../../plans/daily-minutes";
import { type NoSitting } from "../../plans/plan-view-contract";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { findLearningProfileView } from "../../profile/_utils/learning-profile-view";
import {
  getStateProfileSteps,
  toProfileQuestionsView,
} from "../../profile/questions/_utils/profile-question-state";
import { findExamNotice } from "./_utils/onboarding-exam-notice";
import { toOnboardingGoalView } from "./_utils/onboarding-goal-view";
import { findOnboardingGoalIds } from "./_utils/onboarding-goals";
import { getGoalSize, getTimeQuestionDefaults } from "./_utils/recommended-minutes";
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
  isPlanRevealOwed,
} from "./onboarding-steps";

export type OnboardingResult =
  | { onboarding: OnboardingView; status: "ready" }
  | { status: "notFound" | "unauthorized" };

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

/** Daily time doesn't change what the goal is about, so the plan's wait before it can offer one. */
const SUBJECT_QUESTIONS = new Set<OnboardingStep>(
  ONBOARDING_QUESTIONS.filter((question) => question !== "schedule"),
);

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
  if (!COURSE_KINDS.has(goal.kind) || steps.some((step) => SUBJECT_QUESTIONS.has(step))) {
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
export async function getOnboarding({
  goalId,
  locale = "en",
}: {
  goalId: string;
  locale?: SupportedLocale;
}): Promise<OnboardingResult> {
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

  const [profile, activeGoalId, goalIds, notice, planReadiness, firstLesson, warmUp, profileState] =
    await Promise.all([
      findLearningProfileView({
        knownProfile: readLearningProfile(userId),
        readRecentCountries,
        userId,
      }),
      findActiveGoalId(userId),
      findOnboardingGoalIds(goal),
      findExamNotice({ details, goal, goalDate, today }),
      readPlanReadiness({ goalId: goal.id, userId }),
      readGoalOpening({ lessonId: goal.openingLessonId, userId }),
      readWarmUpState(goal.warmUpId),
      readProfileQuestionState(userId),
    ]);

  const [earlierGoals, [view]] = await Promise.all([
    prisma.goal.count({ where: { id: { notIn: goalIds }, userId } }),
    loadGoalViews({
      activeGoalId,
      goals: [goal],
      readRecentCountries,
      readSubscription: readActiveSubscription,
    }),
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
      planRevealed: goal.planRevealedAt !== null,
      replacesGoalId: goal.replacesGoalId,
      targetDate: view.targetDate,
    },
    profile: { hasBuddy: profile.buddy.picked, hasEarlierGoals: earlierGoals > 0 },
    profileSteps: getStateProfileSteps({ goal, state: profileState }),
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
  const { recommendedMinutes, startsOnRecommended } = getTimeQuestionDefaults({
    courseMinutes: courseStart?.dailyMinutes,
    learningNeeds: profileState.profile?.learningNeeds ?? [],
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
      contentCountry: { defaultCountry: view.languageCountry, suggested: view.suggested },
      dateProblem,
      examChoices: notice.choices,
      examDays: notice.examDays,
      examSubjects: notice.subjects,
      firstLesson,
      followUps: getFollowUpQuestions(details),
      generationId: goal.generationRunId,
      goal: toOnboardingGoalView({ kind: goal.kind, view }),
      goalIds,
      languageAim:
        goal.kind === "language"
          ? { ...toLanguageAimView(details), reasons: LANGUAGE_REASON_VIEWS }
          : null,
      libraryCourse,
      planReadiness: planReadiness ?? { readingNotice: false, ready: false },
      planRevealed: !isPlanRevealOwed(goal),
      profile: toProfileQuestionsView({ locale, state: profileState }),
      quickTestMinutes: getQuickTestMinutes(goal.kind),
      recommendedMinutes,
      startsOnRecommended,
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
      warmUp,
    },
    status: "ready",
  };
}
