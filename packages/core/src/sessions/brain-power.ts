import { ENERGY_PER_CORRECT, ENERGY_PER_INCORRECT, ENERGY_PER_STATIC } from "../progress/energy";

/**
 * Brain Power v2, the same in both modes: points only come from learning. Right answers on new or
 * due material earn points, multiplied by Hyperdrive (right answers in a row). Repeating material
 * the learner already knows earns less and less, and a wrong answer costs nothing: it only resets
 * Hyperdrive. Bonuses reward learning actions that matter: finishing a lesson, opening capsules,
 * reaching Solid or Mastered, checkpoints, mocks and the full meal.
 */

/**
 * `new`: a question the learner never got right before. `due`: a review of a skill FSRS says is due,
 * or a drill for a saved mistake. `repeat`: a question already answered right, on a skill that isn't
 * due, which is where farming would happen.
 */
export type AnswerMaterial = "new" | "due" | "repeat";

export type ScoredAnswer = {
  isCorrect: boolean;
  material: AnswerMaterial;
  /** Right answers the learner gave to this same question before; repeats earn less each time. */
  priorRightAnswers: number;
};

/** Hyperdrive multiplies Brain Power by the right answers in a row, up to x5. */
const HYPERDRIVE_CAP = 5;

const POINTS_PER_RIGHT_ANSWER = 2;

/** The first repeat of a known question still earns a little; after that, nothing. */
const FIRST_REPEAT_POINTS = 1;

export const BRAIN_POWER_BONUS = {
  capsuleOpened: 5,
  finalBoss: 300,
  fullMeal: 50,
  lessonFinished: 10,
  phaseBoss: 200,
  skillMastered: 25,
  skillSolid: 10,
  weeklyChallenge: 300,
} as const;

/** After the day's session, extra practice earns at most this much Brain Power a day. */
const EXTRA_PRACTICE_DAILY_CAP = 40;

/** Estimates for session tiles: most answers right, Hyperdrive around x3 on average. */
const EXPECTED_ACCURACY = 0.8;
const EXPECTED_HYPERDRIVE = 3;

export type CheckpointKind = "boss" | "finalBoss" | "weekly";

/** What a finished block did beyond its answers. */
export type BlockOutcome = {
  capsulesOpened: number;
  checkpoint: { kind: CheckpointKind; passed: boolean } | null;
  firstLessonCompletion: boolean;
  skillsMastered: number;
  skillsSolid: number;
};

export const EMPTY_OUTCOME: BlockOutcome = {
  capsulesOpened: 0,
  checkpoint: null,
  firstLessonCompletion: false,
  skillsMastered: 0,
  skillsSolid: 0,
};

function buildsHyperdrive(answer: Pick<ScoredAnswer, "material">): boolean {
  return answer.material !== "repeat";
}

/**
 * The streak after one more answer: new or due material builds it, any wrong answer resets it.
 * The player shows Hyperdrive live with this same rule, so the server's score matches.
 */
export function advanceHyperdrive({
  answer,
  streak,
}: {
  answer: Pick<ScoredAnswer, "isCorrect" | "material">;
  streak: number;
}): number {
  if (!answer.isCorrect) {
    return 0;
  }

  return buildsHyperdrive(answer) ? streak + 1 : streak;
}

/** The multiplier a streak gives: x1 for a first right answer, one more per answer, up to the cap. */
export function getHyperdriveLevel(streak: number): number {
  return Math.min(HYPERDRIVE_CAP, Math.max(1, streak));
}

function getAnswerPoints({ answer, streak }: { answer: ScoredAnswer; streak: number }): number {
  if (!answer.isCorrect) {
    return 0;
  }

  if (answer.material === "repeat") {
    return answer.priorRightAnswers <= 1 ? FIRST_REPEAT_POINTS : 0;
  }

  return POINTS_PER_RIGHT_ANSWER * getHyperdriveLevel(streak);
}

export type ScoredAnswers = {
  brainPower: number;
  /** Each answer's points, in order, so a block can split them between its capsules. */
  points: number[];
  /** The Hyperdrive streak after the last answer, carried into the next block of the session. */
  streak: number;
  /** The highest multiplier reached, shown in Fun as "Top Hyperdrive". */
  topLevel: number;
};

/**
 * Scores answers in the order they were given, continuing the session's Hyperdrive streak. Only
 * new or due material builds Hyperdrive, so repeating easy questions can't pump the multiplier.
 */
export function scoreAnswers({
  answers,
  streak = 0,
}: {
  answers: readonly ScoredAnswer[];
  streak?: number;
}): ScoredAnswers {
  return answers.reduce<ScoredAnswers>(
    (total, answer) => {
      const next = advanceHyperdrive({ answer, streak: total.streak });
      const counts = answer.isCorrect && buildsHyperdrive(answer);
      const points = getAnswerPoints({ answer, streak: next });

      return {
        brainPower: total.brainPower + points,
        points: [...total.points, points],
        streak: next,
        topLevel: counts ? Math.max(total.topLevel, getHyperdriveLevel(next)) : total.topLevel,
      };
    },
    { brainPower: 0, points: [], streak, topLevel: 0 },
  );
}

function getCheckpointBonus(checkpoint: BlockOutcome["checkpoint"]): number {
  if (!checkpoint) {
    return 0;
  }

  if (checkpoint.kind === "weekly") {
    return BRAIN_POWER_BONUS.weeklyChallenge;
  }

  if (!checkpoint.passed) {
    return 0;
  }

  return checkpoint.kind === "finalBoss"
    ? BRAIN_POWER_BONUS.finalBoss
    : BRAIN_POWER_BONUS.phaseBoss;
}

/**
 * Bonuses for what a block achieved. A weekly Big Challenge pays for finishing it, since it
 * measures where the learner is; a boss pays only when won, and losing it costs nothing.
 */
export function getOutcomeBonus(outcome: BlockOutcome): number {
  return (
    (outcome.firstLessonCompletion ? BRAIN_POWER_BONUS.lessonFinished : 0) +
    outcome.capsulesOpened * BRAIN_POWER_BONUS.capsuleOpened +
    outcome.skillsSolid * BRAIN_POWER_BONUS.skillSolid +
    outcome.skillsMastered * BRAIN_POWER_BONUS.skillMastered +
    getCheckpointBonus(outcome.checkpoint)
  );
}

/** Extra practice after the day's session never earns more than the daily cap in total. */
export function capExtraPractice({
  earned,
  earnedToday,
}: {
  earned: number;
  earnedToday: number;
}): number {
  return Math.max(0, Math.min(earned, EXTRA_PRACTICE_DAILY_CAP - earnedToday));
}

/**
 * What a session tile says a block is worth, before it's played: most answers right at an average
 * Hyperdrive, plus the bonus for finishing it (a won boss for a boss tile, "if you win").
 */
export function estimateBrainPower({
  outcome,
  questions,
}: {
  outcome: BlockOutcome;
  questions: number;
}): number {
  const answers = Math.round(
    questions * EXPECTED_ACCURACY * POINTS_PER_RIGHT_ANSWER * EXPECTED_HYPERDRIVE,
  );

  return answers + getOutcomeBonus(outcome);
}

const ENERGY_DECIMALS = 100;

/**
 * Energy keeps today's rules in both modes: it rises with right answers, dips a little with wrong
 * ones, and a block without questions still counts as a little study.
 */
export function getAnswersEnergyDelta({
  correct,
  incorrect,
}: {
  correct: number;
  incorrect: number;
}): number {
  const delta =
    correct + incorrect === 0
      ? ENERGY_PER_STATIC
      : correct * ENERGY_PER_CORRECT + incorrect * ENERGY_PER_INCORRECT;

  return Math.round(delta * ENERGY_DECIMALS) / ENERGY_DECIMALS;
}
