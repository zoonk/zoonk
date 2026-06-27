import { type ScoredRow, findBestByScore } from "@zoonk/utils/aggregation";
import { clampEnergy } from "@zoonk/utils/energy";

export type BestDayScore = { correctAnswers: number; dayOfWeek: number; incorrectAnswers: number };

const ENERGY_MILESTONE_STEP = 10;
const FULL_ENERGY = 100;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
const FULL_DAY_HOURS = 24;
const RANGE_ITEM_COUNT_OFFSET = 1;
const FULL_ENERGY_DAY_REPEAT_INTERVAL = 1000;

type MilestoneRange = { every: number; from: number; to: number };

/**
 * Converts minute-based early checkpoints into seconds because the stored
 * progress total is tracked in seconds, not display units.
 */
function minutesToSeconds(minutes: number) {
  return minutes * SECONDS_PER_MINUTE;
}

/**
 * Converts hour-based milestone rules into seconds at the threshold boundary
 * so crossing detection can compare one unit consistently.
 */
function hoursToSeconds(hours: number) {
  return hours * SECONDS_PER_HOUR;
}

/**
 * Expands an inclusive threshold range so "100 to 1,000 every 100" produces
 * every milestone inside the interval, not just the endpoints.
 */
function milestonesEvery({ every, from, to }: MilestoneRange) {
  const itemCount = Math.floor((to - from) / every) + RANGE_ITEM_COUNT_OFFSET;

  return Array.from({ length: itemCount }, (_, index) => from + index * every);
}

/**
 * Overlapping ranges make the milestone progression easier to read because
 * each interval can include its natural lower bound. Dedupe here keeps those
 * overlaps from creating duplicate screens.
 */
function buildSortedUniqueThresholds(thresholds: number[]) {
  return [...new Set(thresholds)].toSorted((first, second) => first - second);
}

/**
 * Learning-time ranges are written in hours because the product rules are
 * defined in hours after the first 10-minute and 30-minute checkpoints.
 */
function getLearningTimeRangeSeconds(ranges: readonly MilestoneRange[]) {
  return ranges.flatMap((range) => milestonesEvery(range)).map((hours) => hoursToSeconds(hours));
}

/* eslint-disable no-magic-numbers -- These literals are the product milestone ladder. Naming each threshold individually makes the progression harder to audit. */
const FULL_ENERGY_DAY_MILESTONES = new Set([
  30,
  FULL_ENERGY,
  200,
  300,
  365,
  500,
  FULL_ENERGY_DAY_REPEAT_INTERVAL,
]);

const LEARNING_DAY_MILESTONES = new Set(
  buildSortedUniqueThresholds([
    5,
    10,
    30,
    50,
    365,
    ...milestonesEvery({ every: 100, from: 100, to: 1000 }),
    ...milestonesEvery({ every: 1000, from: 2000, to: 10_000 }),
  ]),
);

const LEARNING_TIME_HOUR_RANGES: MilestoneRange[] = [
  { every: 1, from: 1, to: 10 },
  { every: 10, from: 10, to: 100 },
  { every: 100, from: 100, to: 1000 },
  { every: 1000, from: 1000, to: 10_000 },
  { every: 10_000, from: 10_000, to: 100_000 },
  { every: 100_000, from: 100_000, to: 1_000_000 },
  { every: 1_000_000, from: 1_000_000, to: 10_000_000 },
];

const LEARNING_TIME_MILESTONE_SECONDS = buildSortedUniqueThresholds([
  minutesToSeconds(10),
  minutesToSeconds(30),
  hoursToSeconds(FULL_DAY_HOURS),
  ...getLearningTimeRangeSeconds(LEARNING_TIME_HOUR_RANGES),
]);
/* eslint-enable no-magic-numbers */

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
export function getReachedEnergyThreshold({
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
export function isFullEnergyDayMilestone(dayCount: number) {
  return (
    FULL_ENERGY_DAY_MILESTONES.has(dayCount) ||
    (dayCount > FULL_ENERGY_DAY_REPEAT_INTERVAL && dayCount % FULL_ENERGY_DAY_REPEAT_INTERVAL === 0)
  );
}

/**
 * A day should count as newly full only when today's stored daily row was not
 * already capped. This prevents a second lesson at 100% Energy from retriggering
 * the same full-day threshold.
 */
export function hasCompletedNewFullEnergyDay({
  newEnergy,
  todayEnergyAtEnd,
}: {
  newEnergy: number;
  todayEnergyAtEnd: number | null;
}) {
  return (todayEnergyAtEnd ?? 0) < FULL_ENERGY && newEnergy >= FULL_ENERGY;
}

/**
 * Learning-day milestones have a tighter early ladder, a 365-day marker, and
 * then larger long-term checkpoints. Keeping the predicate here lets the
 * milestone builder focus on whether today is a newly counted day.
 */
export function isLearningDayMilestone(dayCount: number) {
  return LEARNING_DAY_MILESTONES.has(dayCount);
}

/**
 * A lesson only creates a new learning day when the snapshot says today has no
 * completed lessons yet. That keeps a second lesson on the same day from
 * replaying a day-count milestone.
 */
export function hasCompletedNewLearningDay({
  todayCompletedLessons = 0,
}: {
  todayCompletedLessons?: number;
}) {
  return todayCompletedLessons === 0;
}

/**
 * Finds the largest learning-time checkpoint crossed by this completion. A
 * single capped lesson can pass more than one early threshold, and showing the
 * highest one keeps the pre-summary flow from stacking several time screens.
 */
export function getReachedLearningTimeThreshold({
  newTotalSeconds,
  previousTotalSeconds,
}: {
  newTotalSeconds: number;
  previousTotalSeconds: number;
}) {
  return (
    LEARNING_TIME_MILESTONE_SECONDS.findLast(
      (seconds) => previousTotalSeconds < seconds && newTotalSeconds >= seconds,
    ) ?? null
  );
}

/**
 * Converts the score-page weekday aggregate into the shared score-row shape so
 * the player and score page rank best weekdays with the same utility.
 */
function getBestDayScoreRow(score: BestDayScore): ScoredRow {
  return { correct: score.correctAnswers, incorrect: score.incorrectAnswers, key: score.dayOfWeek };
}

/**
 * Ranks weekday scores with the same tie-breaking rules as the score page so
 * the milestone never disagrees with the page linked from the screen.
 */
export function getBestDayScore(bestDayScores: BestDayScore[]) {
  return findBestByScore(bestDayScores.map((score) => getBestDayScoreRow(score)));
}
