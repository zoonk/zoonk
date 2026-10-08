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
  /**
   * Memory starts off for a learner under 18 or of unknown age, so onboarding asks them once
   * whether to turn it on, unless they already chose or a guardian keeps it off.
   */
  asksMemory: boolean;
  hasBirth: boolean;
  /** The buddy is offered once, in the learner's first onboarding; Appearance changes it later. */
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

const EXAM_TARGETS = ["admission", "position", "score"] as const;

/**
 * What an exam's learner aims for beyond passing, as onboarding understood it: a course or school
 * (`admission`, ENEM), a score (`score`, IELTS) or a position (`position`, a concurso). Null for
 * an exam that is only passed or failed (the OAB, a license, a class test).
 */
export type ExamTarget = (typeof EXAM_TARGETS)[number];

export function readExamTarget(details: Record<string, unknown>): ExamTarget | null {
  return EXAM_TARGETS.find((target) => target === details.examTarget) ?? null;
}

/** Whether the words already gave what the exam's target question would ask. */
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

/**
 * An exam the learner prepares from their own material (a class test from the teacher's slides):
 * no notice gives its date, so onboarding asks for it.
 */
export function isClassTest(details: Record<string, unknown>): boolean {
  return details.materialIntent === "exam";
}

/** Questions answered on an earlier screen, including the ones skipped. */
export function getAnsweredQuestions(details: Record<string, unknown>): string[] {
  const answered = details.answered;

  return Array.isArray(answered)
    ? answered.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * Whether the learner still has placement ahead: they haven't ended it, and they'll take it (a
 * learner starting from nothing has nothing to place, and one who started at a chapter begins
 * where they chose). Until then, placement may test out what the plan starts with.
 */
export function isPlacementAhead(details: Record<string, unknown>): boolean {
  return (
    !getAnsweredQuestions(details).includes("placement") &&
    details.level !== "none" &&
    !readCourseStart(details)?.chapterId
  );
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
      return kind === "exam" && !hasExamTarget(details);
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
  const picksBuddy = !profile.hasEarlierGoals && !profile.hasBuddy && !answered.has("buddy");

  return [
    !profile.hasBirth && !answered.has("age") && ("age" as const),
    profile.asksMemory && !answered.has("memory") && ("memory" as const),
    picksBuddy && ("buddy" as const),
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
 * and earlier screens didn't answer, then the age when the profile doesn't have it, whether memory
 * may personalize lessons for a learner it starts off for, the buddy in the learner's first
 * onboarding, placement, the daily time, and the plan. A learner starting from
 * nothing skips placement: there's nothing to place, and every phase starts at its beginning. So
 * does one who started at a chapter: the plan begins where they chose. The daily time comes last,
 * once placement said what the learner already knows: it recommends the time the plan needs to
 * cover the whole goal by its date, the same number the plan then shows.
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

  // The next level of a finished plan keeps the learner's time and what onboarding understood, so
  // its curriculum and plan are written without asking again.
  if (typeof goal.details.continuesFromGoalId === "string") {
    return ["plan"];
  }

  const answered = new Set(getAnsweredQuestions(goal.details));
  const questions = getMissingQuestions(goal);

  return [
    ...questions.filter((question) => question !== "schedule"),
    ...getProfileSteps({ answered, profile }),
    ...(isPlacementAhead(goal.details) ? (["placement"] as const) : []),
    ...questions.filter((question) => question === "schedule"),
    "plan",
  ];
}
