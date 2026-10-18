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
  /**
   * The exam has a choice the learner hasn't picked an option of (ENEM's foreign language), read
   * from its notice and plan by callers that load them; others leave it out and never ask.
   */
  hasUnpickedChoice?: boolean;
  kind: GoalKind;
  targetDate: string | null;
};

type StepProfile = {
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
 * (`admission`, ENEM), a score (`score`, IELTS) or a position (`position`, a civil service exam). Null for
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

/** An explicit no-deadline course answer stays undated when its exam notice is read again. */
export function isCourseDateSkipped(goal: Pick<StepGoal, "details" | "targetDate">): boolean {
  return (
    goal.targetDate === null &&
    readCourseStart(goal.details) !== null &&
    getAnsweredQuestions(goal.details).includes("targetDate")
  );
}

/**
 * Whether the learner still has placement ahead: they haven't ended it, and they'll take it (see
 * `isPlacementSkipped`: a learner starting from nothing has nothing to place, and one who started
 * at a chapter begins where they chose). Until then, placement may test out what the plan starts
 * with.
 */
export function isPlacementAhead(details: Record<string, unknown>): boolean {
  return !getAnsweredQuestions(details).includes("placement") && !isPlacementSkipped({ details });
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
 * what order, so only their level, optional date and time are left to ask, plus any exam choices;
 * a chapter start also said where they begin, so it skips their level.
 */
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
 * and earlier screens didn't answer, then the buddy in the learner's first onboarding, placement,
 * the daily time, and the plan. A learner starting from
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
    ...(picksBuddy({ answered, profile }) ? (["buddy"] as const) : []),
    ...(isPlacementAhead(goal.details) ? (["placement"] as const) : []),
    ...questions.filter((question) => question === "schedule"),
    "plan",
  ];
}

/**
 * Whether a course start still has questions before its plan. A course's start builds its default
 * plan right away, so a learner who left the questions halfway has a plan on defaults they never
 * chose (10 minutes a day, every day): Today and the Plan lead back to the questions instead, for a
 * guest and for the account they sign up for. Read from the goal alone: the buddy and an exam choice
 * a later notice adds don't hold back a plan the learner already set up.
 */
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
