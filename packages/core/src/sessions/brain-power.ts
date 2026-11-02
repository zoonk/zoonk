import { ENERGY_PER_CORRECT, ENERGY_PER_INCORRECT, ENERGY_PER_STATIC } from "../progress/energy";

/** new means never answered right; due includes mistake drills; repeat means previously right and not due. */
export type AnswerMaterial = "new" | "due" | "repeat";

export type ScoredAnswer = {
  isCorrect: boolean;
  material: AnswerMaterial;
  /** Right answers the learner gave to this same question before; repeats earn less each time. */
  priorRightAnswers: number;
};

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

const EXPECTED_ACCURACY = 0.8;
const EXPECTED_HYPERDRIVE = 3;

export type CheckpointKind = "boss" | "finalBoss" | "weekly";

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

/** Only new/due right answers build the streak; any wrong answer resets it. */
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
  topLevel: number;
  topStreak: number;
};

/** Requires answer order and the prior block's streak; repeated easy questions cannot build Hyperdrive. */
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
        topStreak: counts ? Math.max(total.topStreak, next) : total.topStreak,
      };
    },
    { brainPower: 0, points: [], streak, topLevel: 0, topStreak: 0 },
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

/** Weekly challenges pay for finishing; bosses pay only for winning and losing costs nothing. */
export function getOutcomeBonus(outcome: BlockOutcome): number {
  return (
    (outcome.firstLessonCompletion ? BRAIN_POWER_BONUS.lessonFinished : 0) +
    outcome.capsulesOpened * BRAIN_POWER_BONUS.capsuleOpened +
    outcome.skillsSolid * BRAIN_POWER_BONUS.skillSolid +
    outcome.skillsMastered * BRAIN_POWER_BONUS.skillMastered +
    getCheckpointBonus(outcome.checkpoint)
  );
}

/** Applies the remaining daily cap across all extra-practice blocks. */
export function capExtraPractice({
  earned,
  earnedToday,
}: {
  earned: number;
  earnedToday: number;
}): number {
  return Math.max(0, Math.min(earned, EXTRA_PRACTICE_DAILY_CAP - earnedToday));
}

/** Estimates assume most answers right and average Hyperdrive; boss tiles include the win bonus conditionally. */
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

/** A block without questions still earns a small Energy increase. */
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
