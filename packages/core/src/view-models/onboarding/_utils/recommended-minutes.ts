import { type GoalKind } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { fromIsoDate } from "../../../plans/planner/plan-calendar";

/** big means public exams; career includes portfolio/job-search work; classTest covers private material; small covers other goals. */
export type GoalSize = "big" | "career" | "classTest" | "small";

/** A test this close that no notice describes is a class test or a quiz, not a public exam. */
const CLASS_TEST_DAYS = 14;

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

/** Undated small goals start with a short sustainable habit rather than an assumed deadline. */
const WITHOUT_DEADLINE: Readonly<Record<GoalSize, number>> = {
  big: 60,
  career: 60,
  classTest: 30,
  small: 15,
};

function getDaysLeft({ targetDate, today }: { targetDate: string; today: string }): number {
  return (fromIsoDate(targetDate).getTime() - fromIsoDate(today).getTime()) / MS_PER_DAY;
}

/** hasNotice means a public notice; learner-uploaded material uses isClassTest. */
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

/** Returns a selectable onboarding default, not a coverage guarantee; only the built plan establishes coverage. */
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

  // An expired exam edition cannot determine the learner's future daily time.
  if (daysLeft < 0) {
    return WITHOUT_DEADLINE[size];
  }

  return (
    BY_DAYS_LEFT[size].find((step) => daysLeft <= step.maxDays)?.minutes ?? WITHOUT_DEADLINE[size]
  );
}
