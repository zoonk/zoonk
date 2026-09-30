import { isJsonObject } from "@zoonk/utils/json";
import { type CourseStart, readCourseStart } from "../../goals/course-start-details";
import {
  ONBOARDING_QUESTIONS,
  type OnboardingQuestion,
  type OnboardingStep,
} from "./onboarding-contract";

type GoalKind = "exam" | "explain" | "language" | "learn";

type StepGoal = { details: Record<string, unknown>; kind: GoalKind; targetDate: string | null };

type StepProfile = {
  experienceMode: "focus" | "fun" | null;
  hasBirth: boolean;
  /** Mode and buddy are chosen once, in the learner's first onboarding. */
  hasEarlierGoals: boolean;
  hasBuddy: boolean;
};

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Work and career-change plans are built around the learner's role, so they ask for it. */
function isRolePurpose(purpose: unknown): boolean {
  return purpose === "work" || purpose === "careerChange";
}

/** A career change needs the role they're aiming for; work needs the role they have. */
function hasRoleAnswer(details: Record<string, unknown>): boolean {
  return details.purpose === "careerChange"
    ? hasText(details.targetPosition)
    : hasText(details.role);
}

/**
 * An exam the learner prepares from their own material (a class test from the teacher's slides):
 * no notice gives its date, so onboarding asks for it.
 */
function isClassTest(details: Record<string, unknown>): boolean {
  return details.materialIntent === "exam";
}

/** Questions answered on an earlier screen, including the ones skipped. */
export function getAnsweredQuestions(details: Record<string, unknown>): string[] {
  const answered = details.answered;

  return Array.isArray(answered)
    ? answered.filter((item): item is string => typeof item === "string")
    : [];
}

/** The AI's follow-up questions for an unusual goal, as stored on the goal. */
export function getFollowUpQuestions(details: Record<string, unknown>): string[] {
  const followUps = details.followUps;

  if (!Array.isArray(followUps)) {
    return [];
  }

  return followUps.flatMap((item: unknown) =>
    isJsonObject(item) && typeof item.question === "string" ? [item.question] : [],
  );
}

/**
 * A course the learner started from its page already says what they'll learn, how deep and in
 * what order, so only their level and time are left to ask; a chapter start also said where they
 * begin, so their time is all.
 */
function isAskedAtCourseStart({
  courseStart,
  question,
}: {
  courseStart: CourseStart;
  question: OnboardingQuestion;
}): boolean {
  return question === "schedule" || (question === "level" && courseStart.chapterId === null);
}

/** Whether each question applies to this goal and the goal doesn't already answer it. */
function isQuestionMissing({ goal, question }: { goal: StepGoal; question: OnboardingQuestion }) {
  const { details, kind } = goal;
  const courseStart = readCourseStart(details);

  if (courseStart && !isAskedAtCourseStart({ courseStart, question })) {
    return false;
  }

  switch (question) {
    case "purpose":
      return kind === "learn" && !hasText(details.purpose);
    case "role":
      return kind === "learn" && isRolePurpose(details.purpose) && !hasRoleAnswer(details);
    case "reason":
      return kind === "language" && !hasText(details.reason);
    case "target":
      return (
        kind === "exam" &&
        !hasText(details.targetScore) &&
        !hasText(details.targetCourse) &&
        !hasText(details.targetPosition)
      );
    case "targetDate":
      return goal.targetDate === null && (kind !== "exam" || isClassTest(details));
    case "followUps":
      return getFollowUpQuestions(details).length > 0;
    case "level":
      return !hasText(details.level);
    case "schedule":
      return true;
    default:
      return false;
  }
}

function getProfileSteps({
  answered,
  profile,
}: {
  answered: Set<string>;
  profile: StepProfile;
}): OnboardingStep[] {
  const choosesMode = !profile.hasEarlierGoals && !answered.has("mode");

  const mayPickBuddy =
    !profile.hasBuddy &&
    !answered.has("buddy") &&
    (choosesMode || profile.experienceMode === "fun");

  return [
    !profile.hasBirth && !answered.has("age") && ("age" as const),
    choosesMode && ("mode" as const),
    mayPickBuddy && ("buddy" as const),
  ].filter((step) => step !== false);
}

/**
 * The questions still ahead for a goal, in the order they're asked: those that apply to it and
 * that neither its words nor an earlier screen answered (skipped ones count as answered).
 */
export function getMissingQuestions(goal: StepGoal): OnboardingQuestion[] {
  const answered = new Set(getAnsweredQuestions(goal.details));

  return ONBOARDING_QUESTIONS.filter(
    (question) => !answered.has(question) && isQuestionMissing({ goal, question }),
  );
}

/**
 * The onboarding screens still ahead for a new goal, in order: only the questions the typed goal
 * and earlier screens didn't answer, then the age when the profile doesn't have it, the mode and
 * buddy in the learner's first onboarding, placement, and the plan. The buddy screen only shows after
 * picking Fun, so it's listed whenever Fun may still be chosen. A learner starting from nothing skips placement: there's
 * nothing to place, and every phase starts at its beginning. So does one who started at a chapter:
 * the plan begins where they chose.
 */
export function getOnboardingSteps({
  goal,
  profile,
}: {
  goal: StepGoal;
  profile: StepProfile;
}): OnboardingStep[] {
  if (goal.kind === "explain") {
    return [];
  }

  const answered = new Set(getAnsweredQuestions(goal.details));
  const questions = getMissingQuestions(goal);

  const startsAtChapter = Boolean(readCourseStart(goal.details)?.chapterId);

  const needsPlacement =
    !answered.has("placement") && goal.details.level !== "none" && !startsAtChapter;

  return [
    ...questions,
    ...getProfileSteps({ answered, profile }),
    ...(needsPlacement ? (["placement"] as const) : []),
    "plan",
  ];
}
