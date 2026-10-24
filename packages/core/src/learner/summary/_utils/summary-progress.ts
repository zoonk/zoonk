import { type Subscription, type UserLearningProfile } from "@zoonk/db";
import { calculateBeltLevel } from "@zoonk/utils/belt-level";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getUsageResets } from "../../../entitlements/_utils/usage-periods";
import { resolveProfileBuddy } from "../../../profile/default-buddy";
import { projectPersistedEnergy } from "../../../progress/energy";
import { hasUserLearningProgress } from "../../../progress/user-progress";
import { getStartOfLocalDay } from "../../_utils/local-time";
import { type LearnerSummary } from "../learner-summary-contract";
import { type LearnerFacts, type StudyDay } from "./load-learner-facts";

function toLocalDate(day: StudyDay): number {
  return new Date(`${day.date}T00:00:00.000Z`).getTime();
}

/**
 * The buddy and the belt as the tabs draw them: kind, name and glasses from the profile, growth
 * from the belt (white before any learning), and Energy from the first thing learned. A buddy
 * never naps on a day the learner studied.
 */
export function getSummaryProgress({
  facts,
  localDate,
  profile,
  timeZone,
}: {
  facts: LearnerFacts;
  /** The learner's day, as a UTC-midnight label. */
  localDate: Date;
  profile: UserLearningProfile | null;
  timeZone: string;
}): Pick<LearnerSummary, "buddy" | "level"> {
  const { currentEnergy, lastActiveAt, totalBrainPower } = facts;

  const progress =
    currentEnergy !== null && lastActiveAt !== null && totalBrainPower !== null
      ? { currentEnergy, lastActiveAt, totalBrainPower }
      : null;

  const learned = hasUserLearningProgress(progress) ? progress : null;
  const belt = learned ? calculateBeltLevel(Number(learned.totalBrainPower)) : null;
  const today = localDate.getTime();

  const studiedToday = facts.recentStudyDays.some(
    (day) => toLocalDate(day) === today && day.timeSpentSeconds > 0,
  );

  const energy = learned
    ? projectPersistedEnergy({ persistedEnergy: learned, targetDate: localDate, timeZone })
        .currentEnergy
    : null;

  const { glasses, kind, name } = resolveProfileBuddy(profile);

  return {
    buddy: { beltColor: belt?.color ?? "white", energy, glasses, kind, name, studiedToday },
    level: belt ? { color: belt.color, level: belt.level } : null,
  };
}

/** The subscription's own next change: a trial or period ending, or a cancellation taking effect. */
function getSubscriptionChanges(subscription: Subscription | null): Date[] {
  if (!subscription) {
    return [];
  }

  return [subscription.trialEnd, subscription.periodEnd, subscription.cancelAt].filter(
    (date): date is Date => date !== null,
  );
}

/**
 * When the summary changes on its own: the learner's next midnight (a new day, its missions and
 * Energy), the next UTC midnight (the allowance's day starts over, and a month's on its first day),
 * the end of a day carried over from the night before, the subscription's next change (an App Store
 * period's end too), or the session's end, whichever comes first.
 */
export function getNextChangeAt({
  carriedUntil,
  localDate,
  now,
  sessionExpiresAt,
  subscription,
  timeZone,
}: {
  /** When the day carried over from the night before stops being the learner's, if it's held. */
  carriedUntil: Date | null;
  localDate: Date;
  now: Date;
  sessionExpiresAt: Date;
  subscription: Subscription | null;
  timeZone: string;
}): number {
  const midnight = getStartOfLocalDay({
    localDate: new Date(localDate.getTime() + MS_PER_DAY),
    timeZone,
  });

  const allowanceResets = getUsageResets(now).day;

  const times = [
    midnight,
    allowanceResets,
    sessionExpiresAt,
    carriedUntil,
    ...getSubscriptionChanges(subscription),
  ]
    .filter((date): date is Date => date !== null)
    .map((date) => date.getTime())
    .filter((time) => time > now.getTime());

  return Math.min(...times);
}
