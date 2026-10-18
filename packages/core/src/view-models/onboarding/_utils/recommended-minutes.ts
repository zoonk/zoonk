import { type GoalKind } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { fromIsoDate } from "../../../plans/planner/plan-calendar";

/**
 * How much a goal asks for: a public exam or an entrance exam (many subjects, a fixed day) is
 * `big`; changing careers or getting a job (a whole field to work in, and a portfolio and job
 * search on top) is `career`; a class test (a few topics from the learner's material, days away)
 * is `classTest`; a subject, a skill or a language is `small`.
 */
export type GoalSize = "big" | "career" | "classTest" | "small";

/** A test this close that no notice describes is a class test or a quiz, not a public exam. */
const CLASS_TEST_DAYS = 14;

/** The sooner the goal's date, the more time a day the time question picks first. */
const BY_DAYS_LEFT: Readonly<Record<GoalSize, readonly { maxDays: number; minutes: number }[]>> = {
  big: [
    { maxDays: 30, minutes: 180 },
    { maxDays: 90, minutes: 120 },
    { maxDays: 180, minutes: 90 },
  ],
  career: [
    { maxDays: 90, minutes: 120 },
    { maxDays: 180, minutes: 90 },
  ],
  classTest: [{ maxDays: 7, minutes: 45 }],
  small: [
    { maxDays: 30, minutes: 60 },
    { maxDays: 90, minutes: 45 },
    { maxDays: 180, minutes: 30 },
  ],
};

/**
 * Without a date soon: a big exam or a new career still takes an hour a day, a class test half an
 * hour, and anything else a short daily habit, which is what lasts ("Even 15 minutes makes a
 * difference").
 */
const WITHOUT_DEADLINE: Readonly<Record<GoalSize, number>> = {
  big: 60,
  career: 60,
  classTest: 30,
  small: 15,
};

function getDaysLeft({ targetDate, today }: { targetDate: string; today: string }): number {
  return (fromIsoDate(targetDate).getTime() - fromIsoDate(today).getTime()) / MS_PER_DAY;
}

/**
 * How big a goal is for the time question: a public or entrance exam is `big`, unless it's a
 * class test (`classTest`: the learner's material describes it, or no notice does and it's days
 * away); a career change or a job in a new role is `career`; anything else is `small`.
 * `hasNotice` is a public notice: the learner's own material read into a notice is `isClassTest`.
 */
export function getGoalSize({
  hasNotice,
  isClassTest,
  kind,
  purpose,
  targetDate,
  targetPosition,
  today,
}: {
  hasNotice: boolean;
  isClassTest: boolean;
  kind: GoalKind;
  purpose: unknown;
  targetDate: string | null;
  targetPosition: unknown;
  today: string;
}): GoalSize {
  if (kind === "exam") {
    const isSoon = targetDate !== null && getDaysLeft({ targetDate, today }) <= CLASS_TEST_DAYS;
    return isClassTest || (!hasNotice && isSoon) ? "classTest" : "big";
  }

  const isCareer =
    purpose === "careerChange" || (typeof targetPosition === "string" && targetPosition.length > 0);

  return kind === "learn" && isCareer ? "career" : "small";
}

/**
 * The daily minutes onboarding's time question picks first. Each one is among the question's own
 * choices. It's only a starting pick from how big the goal is and how soon its date is (the
 * learner's deadline, or the exam's day from its notice): the plan, once built, says what that
 * time covers and the time that covers everything.
 */
export function getRecommendedMinutes({
  size,
  targetDate,
  today,
}: {
  size: GoalSize;
  targetDate: string | null;
  /** The learner's own today, as an ISO date. */
  today: string;
}): number {
  if (!targetDate) {
    return WITHOUT_DEADLINE[size];
  }

  const daysLeft = getDaysLeft({ targetDate, today });

  // A day already past (an old edition's exam) says nothing about the time ahead.
  if (daysLeft < 0) {
    return WITHOUT_DEADLINE[size];
  }

  return (
    BY_DAYS_LEFT[size].find((step) => daysLeft <= step.maxDays)?.minutes ?? WITHOUT_DEADLINE[size]
  );
}
