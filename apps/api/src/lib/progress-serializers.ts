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

/** Never an instant, which a native client could shift into the day before or after. */
function serializeLogicalDate(date: Date): string {
  return getContributionCalendarDateKey(date);
}

function serializeWeekday(dayOfWeek: number) {
  return WEEKDAY_KEYS.at(dayOfWeek) ?? WEEKDAY_KEYS[0];
}

function serializeDaypart(period: number) {
  return DAYPART_KEYS.at(period) ?? DAYPART_KEYS[0];
}

export function serializeLevel(level: BeltLevelDetails) {
  const { color: belt, nextBelt, ...progress } = level;

  return {
    ...progress,
    belt,
    nextBelt: nextBelt && {
      belt: nextBelt.color,
      brainPowerToGo: nextBelt.brainPowerToGo,
      startBrainPower: nextBelt.startBrainPower,
    },
  };
}

function serializeWeekdayPattern(pattern: WeekdayScorePattern) {
  return { ...pattern, dayOfWeek: serializeWeekday(pattern.dayOfWeek) };
}

function serializeTimePattern(pattern: TimeScorePattern) {
  return { ...pattern, period: serializeDaypart(pattern.period) };
}

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

export function serializeLearningActivity(activity: LearningActivityData) {
  return {
    ...activity,
    days: activity.days.map((day) => ({
      activitiesCompleted: day.activitiesCompleted,
      date: serializeLogicalDate(day.date),
      lessonCompletions: day.lessonCompletions,
    })),
  };
}

export function serializeEnergy(energy: EnergyData) {
  return {
    ...energy,
    days: energy.days.map((day) => ({ date: serializeLogicalDate(day.date), energy: day.energy })),
  };
}

/** Drops the server-rendered label: each client localizes chart text itself. */
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
