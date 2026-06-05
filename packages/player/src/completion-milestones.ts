import { type CompletionResult } from "@zoonk/core/player/contracts/completion-input-schema";
import { type BeltLevelResult, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { clampEnergy } from "@zoonk/utils/energy";
import {
  type PlayerCompletionMilestoneKey,
  getUnseenMilestones,
} from "./completion-milestone-keys";

type CompletionProgress = Pick<CompletionResult, "brainPower" | "energyDelta" | "newTotalBp">;

type LevelCompletionMilestone =
  | { belt: BeltLevelResult; kind: "level"; status: "achieved" }
  | {
      currentBelt: BeltLevelResult;
      kind: "level";
      remainingLessons: number;
      status: "halfway";
      targetBelt: BeltLevelResult;
    };

type EnergyCompletionMilestone =
  | { energy: number; kind: "energy"; status: "threshold" }
  | { days: number; kind: "energy"; status: "fullDays" };

type BrainPowerCompletionMilestone = {
  brainPower: number;
  kind: "brainPower";
  status: "dailyRecord";
};

export type PlayerProgressSnapshot = {
  currentEnergy: number;
  fullEnergyDays: number;
  highestPreviousDailyBrainPower: number;
  todayBrainPower: number;
  todayEnergyAtEnd: number | null;
};

export type PlayerCompletionMilestone =
  | BrainPowerCompletionMilestone
  | EnergyCompletionMilestone
  | LevelCompletionMilestone;

const ENERGY_MILESTONE_STEP = 10;
const FULL_ENERGY = 100;
const THIRTY_FULL_ENERGY_DAYS = 30;
const TWO_HUNDRED_FULL_ENERGY_DAYS = 200;
const THREE_HUNDRED_FULL_ENERGY_DAYS = 300;
const FULL_ENERGY_YEAR_DAYS = 365;
const FIVE_HUNDRED_FULL_ENERGY_DAYS = 500;
const THOUSAND_FULL_ENERGY_DAYS = 1000;

const FULL_ENERGY_DAY_MILESTONES = new Set([
  THIRTY_FULL_ENERGY_DAYS,
  FULL_ENERGY,
  TWO_HUNDRED_FULL_ENERGY_DAYS,
  THREE_HUNDRED_FULL_ENERGY_DAYS,
  FULL_ENERGY_YEAR_DAYS,
  FIVE_HUNDRED_FULL_ENERGY_DAYS,
  THOUSAND_FULL_ENERGY_DAYS,
]);

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
 * Energy milestones are shown at visible 10-point boundaries, so decimal
 * progress such as 9.9 -> 10.1 should produce the 10% milestone exactly once.
 */
function getEnergyMilestoneThreshold(energy: number) {
  const clampedEnergy = clampEnergy(energy);

  return Math.floor(clampedEnergy / ENERGY_MILESTONE_STEP) * ENERGY_MILESTONE_STEP;
}

/**
 * The threshold screen should celebrate upward crossings only. If the learner
 * was already inside the same 10-point band before this completion, showing the
 * same threshold again would make ordinary follow-up lessons feel repetitive.
 */
function getReachedEnergyThreshold({
  newEnergy,
  previousEnergy,
}: {
  newEnergy: number;
  previousEnergy: number;
}) {
  const previousThreshold = getEnergyMilestoneThreshold(previousEnergy);
  const newThreshold = getEnergyMilestoneThreshold(newEnergy);

  if (newThreshold === 0 || newThreshold <= previousThreshold) {
    return null;
  }

  return newThreshold;
}

/**
 * Full-energy day milestones use a finite early ladder, then every 1,000 days
 * after the first thousand. Keeping this rule in one predicate avoids repeating
 * a long threshold list in both tests and milestone construction.
 */
function isFullEnergyDayMilestone(dayCount: number) {
  return (
    FULL_ENERGY_DAY_MILESTONES.has(dayCount) ||
    (dayCount > THOUSAND_FULL_ENERGY_DAYS && dayCount % THOUSAND_FULL_ENERGY_DAYS === 0)
  );
}

/**
 * A day should count as newly full only when today's stored daily row was not
 * already capped. This prevents a second lesson at 100% Energy from retriggering
 * the same full-day threshold.
 */
function hasCompletedNewFullEnergyDay({
  newEnergy,
  todayEnergyAtEnd,
}: {
  newEnergy: number;
  todayEnergyAtEnd: number | null;
}) {
  return (todayEnergyAtEnd ?? 0) < FULL_ENERGY && newEnergy >= FULL_ENERGY;
}

/**
 * Computes the post-completion Energy from the server snapshot and the same
 * lesson score used by the completion summary. The server writes the same
 * clamped value later, so the milestone preview matches persisted progress.
 */
function getNewEnergy({
  completion,
  progressSnapshot,
}: {
  completion: CompletionProgress;
  progressSnapshot: PlayerProgressSnapshot;
}) {
  return clampEnergy(progressSnapshot.currentEnergy + completion.energyDelta);
}

/**
 * Builds the 10-point Energy milestone when this completion moves the learner
 * into a new visible Energy band.
 */
function getEnergyThresholdMilestone({
  completion,
  progressSnapshot,
}: {
  completion: CompletionProgress;
  progressSnapshot: PlayerProgressSnapshot | null;
}): EnergyCompletionMilestone | null {
  if (!progressSnapshot) {
    return null;
  }

  const newEnergy = getNewEnergy({ completion, progressSnapshot });

  const energy = getReachedEnergyThreshold({
    newEnergy,
    previousEnergy: progressSnapshot.currentEnergy,
  });

  if (energy === null) {
    return null;
  }

  return { energy, kind: "energy", status: "threshold" };
}

/**
 * Builds the full-energy-day milestone from the pre-completion count plus
 * today's possible first 100% Energy finish.
 */
function getFullEnergyDaysMilestone({
  completion,
  progressSnapshot,
}: {
  completion: CompletionProgress;
  progressSnapshot: PlayerProgressSnapshot | null;
}): EnergyCompletionMilestone | null {
  if (!progressSnapshot) {
    return null;
  }

  const newEnergy = getNewEnergy({ completion, progressSnapshot });

  const completedFullEnergyDay = hasCompletedNewFullEnergyDay({
    newEnergy,
    todayEnergyAtEnd: progressSnapshot.todayEnergyAtEnd,
  });

  const newFullEnergyDays = progressSnapshot.fullEnergyDays + (completedFullEnergyDay ? 1 : 0);

  if (!completedFullEnergyDay || !isFullEnergyDayMilestone(newFullEnergyDays)) {
    return null;
  }

  return { days: newFullEnergyDays, kind: "energy", status: "fullDays" };
}

/**
 * Daily Brain Power records should fire once per day: the first completion that
 * beats every previous day's BP earns the milestone, but later lessons on the
 * same already-record-setting day stay quiet.
 */
function getDailyBrainPowerRecordMilestone({
  completion,
  progressSnapshot,
}: {
  completion: CompletionProgress;
  progressSnapshot: PlayerProgressSnapshot | null;
}): BrainPowerCompletionMilestone | null {
  if (
    !progressSnapshot ||
    completion.brainPower <= 0 ||
    progressSnapshot.highestPreviousDailyBrainPower <= 0
  ) {
    return null;
  }

  const newTodayBrainPower = progressSnapshot.todayBrainPower + completion.brainPower;

  if (
    progressSnapshot.todayBrainPower > progressSnapshot.highestPreviousDailyBrainPower ||
    newTodayBrainPower <= progressSnapshot.highestPreviousDailyBrainPower
  ) {
    return null;
  }

  return { brainPower: newTodayBrainPower, kind: "brainPower", status: "dailyRecord" };
}

/**
 * A belt milestone should only celebrate when the learner crosses into a new
 * visible belt state. Comparing both color and level covers same-color level
 * gains and color changes like White 10 to Yellow 1.
 */
function hasReachedNewBeltLevel({
  currentBelt,
  previousBelt,
}: {
  currentBelt: BeltLevelResult;
  previousBelt: BeltLevelResult;
}) {
  return currentBelt.color !== previousBelt.color || currentBelt.level !== previousBelt.level;
}

/**
 * Halfway milestones should fire once per level, exactly when the new total
 * moves from the first half of the current level into the second half. This
 * keeps the screen meaningful without showing it again on every later lesson.
 */
function hasReachedLevelHalfway({
  currentBelt,
  previousBelt,
}: {
  currentBelt: BeltLevelResult;
  previousBelt: BeltLevelResult;
}) {
  const halfwayBp = currentBelt.bpPerLevel / 2;

  const stayedInSameLevel =
    currentBelt.color === previousBelt.color && currentBelt.level === previousBelt.level;

  return (
    stayedInSameLevel &&
    !currentBelt.isMaxLevel &&
    previousBelt.progressInLevel < halfwayBp &&
    currentBelt.progressInLevel >= halfwayBp
  );
}

/**
 * The halfway message names the next visible belt state, not the level the
 * learner is currently inside. Adding the remaining BP to the current total
 * asks the shared belt calculator for that next visible state directly.
 */
function getNextBeltLevel({
  currentBelt,
  totalBrainPower,
}: {
  currentBelt: BeltLevelResult;
  totalBrainPower: number;
}) {
  return calculateBeltLevel(totalBrainPower + currentBelt.bpToNextLevel);
}

/**
 * The milestone copy talks in lessons because that is the action learners can
 * take next. Using the current lesson reward keeps the estimate aligned with
 * the same scoring contract that produced the completion result.
 */
function getRemainingLessonCount({
  brainPower,
  currentBelt,
}: {
  brainPower: number;
  currentBelt: BeltLevelResult;
}) {
  if (brainPower <= 0) {
    return currentBelt.bpToNextLevel;
  }

  return Math.ceil(currentBelt.bpToNextLevel / brainPower);
}

/**
 * Builds the level milestone for a completion. Achieved level changes outrank
 * halfway nudges inside this family, so crossing a belt boundary never also
 * shows the halfway message for the level that just ended.
 */
function getLevelCompletionMilestone({
  completion,
  previousTotalBrainPower,
}: {
  completion: CompletionProgress;
  previousTotalBrainPower: number;
}): LevelCompletionMilestone | null {
  const currentBelt = calculateBeltLevel(completion.newTotalBp);
  const previousBelt = calculateBeltLevel(previousTotalBrainPower);

  if (hasReachedNewBeltLevel({ currentBelt, previousBelt })) {
    return { belt: currentBelt, kind: "level", status: "achieved" };
  }

  if (!hasReachedLevelHalfway({ currentBelt, previousBelt })) {
    return null;
  }

  return {
    currentBelt,
    kind: "level",
    remainingLessons: getRemainingLessonCount({ brainPower: completion.brainPower, currentBelt }),
    status: "halfway",
    targetBelt: getNextBeltLevel({ currentBelt, totalBrainPower: completion.newTotalBp }),
  };
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
  localDate = "",
  previousTotalBrainPower,
  progressSnapshot = null,
  shownMilestoneKeys = [],
}: {
  completion: CompletionProgress;
  localDate?: string;
  previousTotalBrainPower: number;
  progressSnapshot?: PlayerProgressSnapshot | null;
  shownMilestoneKeys?: readonly PlayerCompletionMilestoneKey[];
}): PlayerCompletionMilestone[] {
  const milestones = [
    getLevelCompletionMilestone({ completion, previousTotalBrainPower }),
    getEnergyThresholdMilestone({ completion, progressSnapshot }),
    getFullEnergyDaysMilestone({ completion, progressSnapshot }),
    getDailyBrainPowerRecordMilestone({ completion, progressSnapshot }),
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
  localDate = "",
  previousTotalBrainPower,
  progressSnapshot = null,
  shownMilestoneKeys = [],
}: {
  completion: CompletionProgress;
  localDate?: string;
  previousTotalBrainPower: number;
  progressSnapshot?: PlayerProgressSnapshot | null;
  shownMilestoneKeys?: readonly PlayerCompletionMilestoneKey[];
}): number | null {
  const milestones = getCompletionMilestones({
    completion,
    localDate,
    previousTotalBrainPower,
    progressSnapshot,
    shownMilestoneKeys,
  });

  return milestones.length > 0 ? 0 : null;
}
