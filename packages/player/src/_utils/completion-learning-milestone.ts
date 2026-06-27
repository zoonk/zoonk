import { type PlayerProgressSnapshot } from "../completion-milestones";
import {
  getReachedLearningTimeThreshold,
  hasCompletedNewLearningDay,
  isLearningDayMilestone,
} from "./completion-milestone-thresholds";

export type LearningDaysCompletionMilestone = { days: number; kind: "learningDays" };

export type LearningTimeCompletionMilestone = { kind: "learningTime"; seconds: number };

/**
 * Builds the learning-day milestone when this completion is the first saved
 * lesson today and that new day lands on one of the visible checkpoints.
 */
export function getLearningDaysMilestone({
  progressSnapshot,
}: {
  progressSnapshot: PlayerProgressSnapshot | null;
}): LearningDaysCompletionMilestone | null {
  if (
    !progressSnapshot ||
    !hasCompletedNewLearningDay({ todayCompletedLessons: progressSnapshot.todayCompletedLessons })
  ) {
    return null;
  }

  const newLearningDays = (progressSnapshot.learningDays ?? 0) + 1;

  if (!isLearningDayMilestone(newLearningDays)) {
    return null;
  }

  return { days: newLearningDays, kind: "learningDays" };
}

/**
 * Builds the total learning-time milestone from the lifetime server total plus
 * the capped duration for this completed lesson.
 */
export function getLearningTimeMilestone({
  lessonDurationSeconds,
  progressSnapshot,
}: {
  lessonDurationSeconds: number;
  progressSnapshot: PlayerProgressSnapshot | null;
}): LearningTimeCompletionMilestone | null {
  if (!progressSnapshot || lessonDurationSeconds <= 0) {
    return null;
  }

  const previousTotalSeconds = progressSnapshot.totalLearningSeconds ?? 0;
  const newTotalSeconds = previousTotalSeconds + lessonDurationSeconds;
  const seconds = getReachedLearningTimeThreshold({ newTotalSeconds, previousTotalSeconds });

  if (seconds === null) {
    return null;
  }

  return { kind: "learningTime", seconds };
}
