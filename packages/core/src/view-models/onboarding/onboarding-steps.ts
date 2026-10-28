import { type Goal } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type CourseStart, readCourseStart } from "../../goals/course-start-details";
import { isPlacementSkipped } from "../../learner/placement/placement-contract";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import {
  ONBOARDING_QUESTIONS,
  type OnboardingQuestion,
  type OnboardingStep,
} from "./onboarding-contract";

type GoalKind = "exam" | "explain" | "language" | "learn";

type StepGoal = {
  details: Record<string, unknown>;
  /** Omit unless the caller loaded notice/plan choices; omission never asks an exam-choice question. */
  hasUnpickedChoice?: boolean;
  kind: GoalKind;
  targetDate: string | null;
};

type StepProfile = {
  /** Buddy is offered only in the first onboarding; later changes belong to Appearance. */
  hasEarlierGoals: boolean;
  hasBuddy: boolean;
};

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isRolePurpose(purpose: unknown): boolean {
  return purpose === "work" || purpose === "careerChange";
}

/** Career changes ask for the target role; work goals ask for the current role. */
function hasRoleAnswer(details: Record<string, unknown>): boolean {
  return details.purpose === "careerChange"
    ? hasText(details.targetPosition)
    : hasText(details.role);
}

const EXAM_TARGETS = ["admission", "position", "score"] as const;

/** null means pass/fail only; admission, score, and position describe targets beyond passing. */
export type ExamTarget = (typeof EXAM_TARGETS)[number];

export function readExamTarget(details: Record<string, unknown>): ExamTarget | null {
  return EXAM_TARGETS.find((target) => target === details.examTarget) ?? null;
}

function hasExamTarget(details: Record<string, unknown>): boolean {
  switch (readExamTarget(details)) {
    case "admission":
      return hasText(details.targetCourse) || hasText(details.targetScore);
    case "position":
      return hasText(details.targetPosition);
    case "score":
      return hasText(details.targetScore);
    case null:
      return true;
    default:
      return true;
  }
}

export function isClassTest(details: Record<string, unknown>): boolean {
  return details.materialIntent === "exam";
}

/** Includes explicitly skipped questions. */
export function getAnsweredQuestions(details: Record<string, unknown>): string[] {
  const answered = details.answered;

  return Array.isArray(answered)
    ? answered.filter((item): item is string => typeof item === "string")
    : [];
}

/** An explicit no-deadline course answer stays undated when its exam notice is read again. */
export function isCourseDateSkipped(goal: Pick<StepGoal, "details" | "targetDate">): boolean {
  return (
    goal.targetDate === null &&
    readCourseStart(goal.details) !== null &&
    getAnsweredQuestions(goal.details).includes("targetDate")
  );
}

export function isPlacementAhead(details: Record<string, unknown>): boolean {
  return !getAnsweredQuestions(details).includes("placement") && !isPlacementSkipped({ details });
}

export function getFollowUpQuestions(details: Record<string, unknown>): string[] {
  const followUps = details.followUps;

  if (!Array.isArray(followUps)) {
    return [];
  }

  return followUps.flatMap((item: unknown) =>
    isJsonObject(item) && typeof item.question === "string" ? [item.question] : [],
  );
}

/** Course starts already choose subject/depth/order; chapter starts also choose the starting level. */
function isAskedAtCourseStart({
  courseStart,
  question,
}: {
  courseStart: CourseStart;
  question: OnboardingQuestion;
}): boolean {
  return (
    question === "schedule" ||
    question === "targetDate" ||
    question === "examChoice" ||
    (question === "level" && courseStart.chapterId === null)
  );
}

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
      return kind === "exam" && !hasExamTarget(details);
    case "targetDate":
      return isDateMissing(goal);
    case "followUps":
      return getFollowUpQuestions(details).length > 0;
    case "examChoice":
      return kind === "exam" && goal.hasUnpickedChoice === true;
    case "level":
      return !hasText(details.level);
    case "schedule":
      return true;
    default:
      return false;
  }
}

/** A course's notice date is a default: only a learner answer removes its date question. */
function isDateMissing(goal: StepGoal): boolean {
  return (
    readCourseStart(goal.details) !== null ||
    (goal.targetDate === null && (goal.kind !== "exam" || isClassTest(goal.details)))
  );
}

function picksBuddy({ answered, profile }: { answered: Set<string>; profile: StepProfile }) {
  return !profile.hasEarlierGoals && !profile.hasBuddy && !answered.has("buddy");
}

/** Preserves question order and treats skipped questions as answered. */
export function getMissingQuestions(goal: StepGoal): OnboardingQuestion[] {
  const answered = new Set(getAnsweredQuestions(goal.details));

  return ONBOARDING_QUESTIONS.filter(
    (question) => !answered.has(question) && isQuestionMissing({ goal, question }),
  );
}

/** Skips known answers and unnecessary placement; daily time comes last so its recommendation reflects placement results. */
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

  // Continuing a completed plan retains its understood details and time without repeating onboarding.
  if (typeof goal.details.continuesFromGoalId === "string") {
    return ["plan"];
  }

  const answered = new Set(getAnsweredQuestions(goal.details));
  const questions = getMissingQuestions(goal);

  return [
    ...questions.filter((question) => question !== "schedule"),
    ...(picksBuddy({ answered, profile }) ? (["buddy"] as const) : []),
    ...(isPlacementAhead(goal.details) ? (["placement"] as const) : []),
    ...questions.filter((question) => question === "schedule"),
    "plan",
  ];
}

/** A default course plan is not configured until learner questions finish; later buddy/notice choices must not reopen setup. */
export function isCourseSetupLeft(goal: Pick<Goal, "details" | "kind" | "targetDate">): boolean {
  const details = isJsonObject(goal.details) ? goal.details : {};

  if (!readCourseStart(details)) {
    return false;
  }

  const steps = getOnboardingSteps({
    goal: {
      details,
      kind: goal.kind,
      targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : null,
    },
    profile: { hasBuddy: true, hasEarlierGoals: true },
  });

  return steps.some((step) => step !== "plan");
}
