import { type PlayerInitialProgress } from "@zoonk/core/player/contracts/progress-snapshot";
import { type EnergyData } from "@zoonk/core/progress/energy";
import { type BeltLevelDetails } from "@zoonk/core/progress/get-belt-level";
import { type CurrentUserProgress } from "@zoonk/core/progress/get-current-user";
import { type LearningActivityData } from "@zoonk/core/progress/get-learning-activity";
import { type ScoreHistoryResource } from "@zoonk/core/progress/get-score-history";
import {
  type ScorePatternsData,
  type TimeScorePattern,
  type WeekdayScorePattern,
} from "@zoonk/core/progress/get-score-patterns";
import { type BeltLevelResult } from "@zoonk/utils/belt-level";
import { getContributionCalendarDateKey } from "@zoonk/utils/contribution-calendar";

const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const DAYPART_KEYS = ["night", "morning", "afternoon", "evening"] as const;

/**
 * Serializes a learner-local calendar date without turning it into an instant
 * that a native client could shift into the preceding or following day.
 */
function serializeLogicalDate(date: Date): string {
  return getContributionCalendarDateKey(date);
}

/**
 * Converts JavaScript's internal Sunday-based index into a stable semantic key
 * so API clients do not need to know the server runtime's weekday convention.
 */
function serializeWeekday(dayOfWeek: number) {
  return WEEKDAY_KEYS.at(dayOfWeek) ?? WEEKDAY_KEYS[0];
}

/**
 * Converts the internal 0-to-3 daypart index into a descriptive API value that
 * remains understandable across web, native, CLI, and agent clients.
 */
function serializeDaypart(period: number) {
  return DAYPART_KEYS.at(period) ?? DAYPART_KEYS[0];
}

/**
 * Renames the internal belt color identity to a domain field so clients remain
 * free to choose their own presentation color for each tier.
 */
export function serializeBeltLevel(level: BeltLevelDetails | BeltLevelResult) {
  const { color: belt, ...progress } = level;
  return { ...progress, belt };
}

/**
 * Preserves the public Level serializer name while sharing the belt identity
 * mapping with lesson-completion responses.
 */
export function serializeLevel(level: BeltLevelDetails) {
  return serializeBeltLevel(level);
}

/**
 * Converts one internal weekday pattern into the semantic public API shape.
 */
function serializeWeekdayPattern(pattern: WeekdayScorePattern) {
  return { ...pattern, dayOfWeek: serializeWeekday(pattern.dayOfWeek) };
}

/**
 * Converts one internal time pattern into the semantic public API shape.
 */
function serializeTimePattern(pattern: TimeScorePattern) {
  return { ...pattern, period: serializeDaypart(pattern.period) };
}

/**
 * Converts the complete Score-pattern resource without changing its stable
 * seven-weekday and four-daypart ordering.
 */
export function serializeScorePatterns(patterns: ScorePatternsData) {
  return {
    strongestTime: patterns.strongestTime ? serializeTimePattern(patterns.strongestTime) : null,
    strongestWeekday: patterns.strongestWeekday
      ? serializeWeekdayPattern(patterns.strongestWeekday)
      : null,
    times: patterns.times.map(serializeTimePattern),
    weekdays: patterns.weekdays.map(serializeWeekdayPattern),
  };
}

/**
 * Serializes the compact Home resource while keeping Core's numeric values
 * private and presenting semantic belt, weekday, and daypart identifiers.
 */
export function serializeCurrentUserProgress(progress: CurrentUserProgress) {
  return {
    ...progress,
    level: progress.level ? serializeLevel(progress.level) : null,
    scorePatterns: progress.scorePatterns
      ? {
          strongestTime: progress.scorePatterns.strongestTime
            ? serializeTimePattern(progress.scorePatterns.strongestTime)
            : null,
          strongestWeekday: progress.scorePatterns.strongestWeekday
            ? serializeWeekdayPattern(progress.scorePatterns.strongestWeekday)
            : null,
        }
      : null,
  };
}

/**
 * Converts Activity's bounded Date values into the OpenAPI date-only contract
 * while preserving the complete zero-filled calendar and lifetime totals.
 */
export function serializeLearningActivity(activity: LearningActivityData) {
  return {
    ...activity,
    days: activity.days.map((day) => ({
      date: serializeLogicalDate(day.date),
      lessonCompletions: day.lessonCompletions,
    })),
  };
}

/**
 * Converts Energy's bounded learner-local timeline into date-only JSON without
 * changing null gaps or the already calculated aggregate insights.
 */
export function serializeEnergy(energy: EnergyData) {
  return {
    ...energy,
    days: energy.days.map((day) => ({ date: serializeLogicalDate(day.date), energy: day.energy })),
  };
}

/**
 * Publishes raw Score dates and numeric performance while intentionally
 * dropping the server-rendered compatibility label so each client localizes
 * chart text using its own locale APIs.
 */
export function serializeScore(score: ScoreHistoryResource) {
  return {
    correctAnswers: score.correctAnswers,
    dataPoints: score.dataPoints.map((point) => ({
      correctAnswers: point.correctAnswers,
      date: serializeLogicalDate(point.date),
      incorrectAnswers: point.incorrectAnswers,
      score: point.score,
      totalAnswers: point.totalAnswers,
    })),
    incorrectAnswers: score.incorrectAnswers,
    periodEnd: serializeLogicalDate(score.periodEnd),
    periodStart: serializeLogicalDate(score.periodStart),
    score: score.score,
    totalAnswers: score.totalAnswers,
  };
}

/**
 * Converts the player's best-day facts to semantic weekdays while preserving
 * every numeric milestone used to compute post-completion effects.
 */
export function serializeProgressSnapshot(snapshot: PlayerInitialProgress) {
  return {
    ...snapshot,
    progressSnapshot: {
      ...snapshot.progressSnapshot,
      bestDayScores: snapshot.progressSnapshot.bestDayScores?.map((score) => ({
        ...score,
        dayOfWeek: serializeWeekday(score.dayOfWeek),
      })),
    },
  };
}
