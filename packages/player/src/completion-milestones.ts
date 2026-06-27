import { type CompletionResult } from "@zoonk/core/player/contracts/completion-input-schema";
import {
  type BrainPowerCompletionMilestone,
  getDailyBrainPowerRecordMilestone,
} from "./_utils/completion-brain-power-milestone";
import {
  type EnergyCompletionMilestone,
  getEnergyThresholdMilestone,
  getFullEnergyDaysMilestone,
} from "./_utils/completion-energy-milestone";
import {
  type LearningDaysCompletionMilestone,
  type LearningTimeCompletionMilestone,
  getLearningDaysMilestone,
  getLearningTimeMilestone,
} from "./_utils/completion-learning-milestone";
import {
  type LevelCompletionMilestone,
  getLevelCompletionMilestone,
} from "./_utils/completion-level-milestone";
import { type BestDayScore } from "./_utils/completion-milestone-thresholds";
import {
  type ScoreCompletionMilestone,
  getBestDayMilestone,
} from "./_utils/completion-score-milestone";
import {
  type PlayerCompletionMilestoneKey,
  getUnseenMilestones,
} from "./completion-milestone-keys";

export type PlayerCompletionResult = CompletionResult & {
  completedInteractiveLesson?: boolean;
  lessonDurationSeconds?: number;
};

export type CompletionProgress = Pick<
  CompletionResult,
  "brainPower" | "energyDelta" | "newTotalBp"
> &
  Partial<Pick<CompletionResult, "correctCount" | "incorrectCount">> & {
    completedInteractiveLesson?: boolean;
    lessonDurationSeconds?: number;
  };

export type PlayerProgressSnapshot = {
  bestDayScores: BestDayScore[];
  currentEnergy: number;
  fullEnergyDays: number;
  highestPreviousDailyBrainPower: number;
  learningDays: number;
  todayBrainPower: number;
  todayCompletedLessons: number;
  todayEnergyAtEnd: number | null;
  todayInteractiveLessons: number;
  totalLearningSeconds: number;
};

export type PlayerCompletionMilestone =
  | BrainPowerCompletionMilestone
  | EnergyCompletionMilestone
  | LearningDaysCompletionMilestone
  | LearningTimeCompletionMilestone
  | LevelCompletionMilestone
  | ScoreCompletionMilestone;

/**
 * Null milestones are a natural result of independent checks. This guard keeps
 * the final array typed without making each caller build temporary mutable
 * arrays.
 */
function isMilestone(
  milestone: PlayerCompletionMilestone | null,
): milestone is PlayerCompletionMilestone {
  return milestone !== null;
}

/**
 * Derives the ordered milestone screens that should appear after a completion.
 *
 * Each milestone compares the post-lesson value with the page-load snapshot, so
 * repeated lessons only show a screen when this specific completion crossed a
 * new boundary.
 */
export function getCompletionMilestones({
  completion,
  lessonDurationSeconds = completion.lessonDurationSeconds ?? 0,
  localDate = "",
  previousTotalBrainPower,
  progressSnapshot = null,
  shownMilestoneKeys = [],
}: {
  completion: CompletionProgress;
  lessonDurationSeconds?: number;
  localDate?: string;
  previousTotalBrainPower: number;
  progressSnapshot?: PlayerProgressSnapshot | null;
  shownMilestoneKeys?: readonly PlayerCompletionMilestoneKey[];
}): PlayerCompletionMilestone[] {
  const milestones = [
    getLevelCompletionMilestone({ completion, previousTotalBrainPower }),
    getLearningDaysMilestone({ progressSnapshot }),
    getLearningTimeMilestone({ lessonDurationSeconds, progressSnapshot }),
    getEnergyThresholdMilestone({ completion, progressSnapshot }),
    getFullEnergyDaysMilestone({ completion, progressSnapshot }),
    getDailyBrainPowerRecordMilestone({ completion, progressSnapshot }),
    getBestDayMilestone({ completion, localDate, progressSnapshot }),
  ].filter((milestone) => isMilestone(milestone));

  return getUnseenMilestones({ localDate, milestones, shownMilestoneKeys });
}

/**
 * Finds the first milestone index for a completed lesson. Returning null
 * instead of -1 keeps reducer state explicit: null means the summary screen is
 * active and a number means that milestone screen still needs to be shown.
 */
export function getInitialCompletionMilestoneIndex({
  completion,
  lessonDurationSeconds = completion.lessonDurationSeconds ?? 0,
  localDate = "",
  previousTotalBrainPower,
  progressSnapshot = null,
  shownMilestoneKeys = [],
}: {
  completion: CompletionProgress;
  lessonDurationSeconds?: number;
  localDate?: string;
  previousTotalBrainPower: number;
  progressSnapshot?: PlayerProgressSnapshot | null;
  shownMilestoneKeys?: readonly PlayerCompletionMilestoneKey[];
}): number | null {
  const milestones = getCompletionMilestones({
    completion,
    lessonDurationSeconds,
    localDate,
    previousTotalBrainPower,
    progressSnapshot,
    shownMilestoneKeys,
  });

  return milestones.length > 0 ? 0 : null;
}
