import { type LanguageSkill } from "@zoonk/db";
import {
  CEFR_LEVELS,
  type CefrLevel,
  MAX_CEFR_SCORE,
  clampCefrScore,
  formatCefrScore,
} from "@zoonk/utils/cefr";
import { LANGUAGE_SKILLS } from "../levels/skill-level-rules";
import { hasCompleteLevelCheck, listLevelConfirmations } from "./_utils/confirmation-bank";
import {
  type Posterior,
  type ScoredAnswer,
  getLowerBound,
  getMean,
  getPosterior,
  getUpperBound,
} from "./_utils/level-test-posterior";
import {
  LANGUAGE_LEVEL_TEST_OFFER,
  LEVEL_TEST_BLOCK_SIZE,
  type LevelTestBank,
  type LevelTestConfirmation,
  type LevelTestProgress,
  type LevelTestQuestion,
  type LevelTestRanges,
} from "./level-test-contract";

type TestAnswers = Pick<LevelTestProgress, "firstBand" | "placement" | "result" | "speaking"> & {
  answers: readonly Pick<
    LevelTestProgress["answers"][number],
    "audioDeferred" | "answerIndex" | "correct" | "id" | "skipped"
  >[];
};

const QUESTION_SKILLS = ["reading", "listening"] as const;

const HALF_STEP = 0.5;
const UNKNOWN_STREAK = 2;

type QuestionSkill = (typeof QUESTION_SKILLS)[number];

export type LevelTestScores = Partial<Record<QuestionSkill | "speaking", number>>;

export function getBand(level: CefrLevel): number {
  return CEFR_LEVELS.indexOf(level);
}

function getTargetBand({
  scored,
  posterior,
  start,
}: {
  scored: ScoredAnswer[];
  posterior: Posterior;
  start: number;
}) {
  const last = scored.at(-1);

  if (!last) {
    return Math.round(start);
  }

  const likely = posterior.reduce(
    (best, point) => (point.probability > best.probability ? point : best),
    { probability: 0, theta: start },
  ).theta;

  if (scored.every(({ correct }) => correct)) {
    const rise = scored.length > 1 ? 2 : 1;
    return Math.min(MAX_CEFR_SCORE, Math.max(last.band + rise, Math.ceil(likely)));
  }

  return last.correct ? Math.ceil(likely) : Math.floor(likely);
}

export function getAnswerVerdict({
  answer,
  question,
}: {
  answer: Pick<LevelTestProgress["answers"][number], "answerIndex" | "correct">;
  question: Pick<LevelTestQuestion, "answerIndex">;
}): boolean | null {
  if (answer.correct !== undefined) {
    return answer.correct;
  }

  return answer.answerIndex === null ? null : answer.answerIndex === question.answerIndex;
}

function analyze({
  answers,
  bank,
  skill,
  start,
}: {
  answers: TestAnswers["answers"];
  bank: LevelTestBank;
  skill?: QuestionSkill;
  start: number;
}) {
  const questions = new Map(
    bank.questions
      .filter((question) => !skill || question.skill === skill)
      .map((question) => [question.id, question]),
  );

  const asked = answers.filter((answer) => questions.has(answer.id));

  const scored = asked.flatMap((answer) => {
    const question = questions.get(answer.id);

    if (!question || answer.skipped) {
      return [];
    }

    return [{ band: getBand(question.level), correct: getAnswerVerdict({ answer, question }) }];
  });

  const lastTwo = scored.slice(-UNKNOWN_STREAK);

  const unknownStreak =
    lastTwo.length === UNKNOWN_STREAK &&
    lastTwo.every(({ band, correct }) => band === 0 && correct === null);

  return {
    asked: asked.length,
    complete:
      unknownStreak ||
      (asked.length >= LEVEL_TEST_BLOCK_SIZE &&
        scored.length >= LEVEL_TEST_BLOCK_SIZE - 1 &&
        !asked.some((answer) => answer.audioDeferred)),
    posterior: getPosterior({ answers: scored, start }),
    scored,
    unknownStreak,
  };
}

export function estimatePooledScore({
  answers,
  bank,
  start,
}: {
  answers: TestAnswers["answers"];
  bank: LevelTestBank;
  start: number;
}): { answered: number; score: number } {
  const { posterior, scored } = analyze({ answers, bank, start });
  return { answered: scored.length, score: scored.length === 0 ? start : getMean(posterior) };
}

function pickQuestion({
  bank,
  used,
  target,
  skill,
}: {
  bank: LevelTestBank;
  used: ReadonlySet<string>;
  target: number;
  skill: QuestionSkill;
}): LevelTestQuestion | null {
  return (
    bank.questions
      .filter((question) => question.skill === skill && !used.has(question.id))
      .toSorted(
        (a, b) =>
          Math.abs(getBand(a.level) - target) - Math.abs(getBand(b.level) - target) ||
          getBand(a.level) - getBand(b.level),
      )[0] ?? null
  );
}

export type LevelTestStep =
  | { kind: "done" }
  | { kind: "question"; question: LevelTestQuestion }
  | { kind: "confirmation"; question: LevelTestConfirmation };

function getConfirmations({
  bank,
  progress,
  floor,
}: {
  bank: LevelTestBank;
  progress: TestAnswers;
  floor: number;
}): { next: LevelTestConfirmation | null; shortLevels: CefrLevel[]; through: CefrLevel | null } {
  const answers = new Map(progress.answers.map((answer) => [answer.id, answer]));
  const levels = CEFR_LEVELS.slice(0, floor + 1).toReversed();
  const shortLevels: CefrLevel[] = [];

  for (const level of levels) {
    const items = listLevelConfirmations({ bank, level });

    if (!hasCompleteLevelCheck(items)) {
      shortLevels.push(level);
    } else if (items.every(({ id }) => !answers.has(id) || answers.get(id)?.correct === true)) {
      const next = items.find(({ id }) => !answers.has(id)) ?? null;
      return { next, shortLevels, through: next ? null : level };
    } else {
      break;
    }
  }

  return { next: null, shortLevels, through: null };
}

export function getLevelTestAssessment({
  bank,
  progress,
  start,
}: {
  bank: LevelTestBank;
  progress: TestAnswers;
  start: number;
}) {
  return QUESTION_SKILLS.map((skill) => ({
    ...analyze({ answers: progress.answers, bank, skill, start }),
    skill,
  }));
}

function getProposedFloor(assessment: ReturnType<typeof getLevelTestAssessment>) {
  if (assessment.some(({ complete, unknownStreak }) => !complete || unknownStreak)) {
    return -1;
  }

  return Math.floor(
    Math.min(...assessment.map(({ posterior }) => getLowerBound(posterior))) - HALF_STEP,
  );
}

export function getLevelTestConfirmation({
  bank,
  progress,
  start,
}: Parameters<typeof getLevelTestAssessment>[0]) {
  return getConfirmations({
    bank,
    floor: getProposedFloor(getLevelTestAssessment({ bank, progress, start })),
    progress,
  });
}

export function getNextLevelTestStep({
  bank,
  progress,
  start,
}: Parameters<typeof getLevelTestAssessment>[0]): LevelTestStep {
  if (
    progress.placement ||
    progress.result ||
    progress.answers.some((answer) => answer.audioDeferred) ||
    progress.answers.length >= LANGUAGE_LEVEL_TEST_OFFER.total
  ) {
    return { kind: "done" };
  }

  const assessment = getLevelTestAssessment({ bank, progress, start });
  const used = new Set(progress.answers.map((answer) => answer.id));

  const question = assessment
    .filter(({ asked, complete }) => asked < LEVEL_TEST_BLOCK_SIZE && !complete)
    .map(({ posterior, scored, skill }) =>
      pickQuestion({
        bank,
        skill,
        target: getTargetBand({ posterior, scored, start: progress.firstBand ?? start }),
        used,
      }),
    )
    .find((picked) => picked !== null);

  if (question) {
    return { kind: "question", question };
  }

  const { next } = getConfirmations({ bank, floor: getProposedFloor(assessment), progress });
  return next ? { kind: "confirmation", question: next } : { kind: "done" };
}

export function getLevelTestScores(
  input: Parameters<typeof getLevelTestAssessment>[0],
): LevelTestScores {
  return Object.fromEntries(
    getLevelTestAssessment(input).flatMap(({ posterior, scored, skill }) =>
      scored.length > 0 ? [[skill, clampCefrScore(getMean(posterior))]] : [],
    ),
  );
}

/**
 * The level each skill's answers say the learner is at least at: the bottom of its range. The
 * middle of the range can guide lessons, but does not establish what the learner knows.
 */
export function getLevelTestFloors(
  input: Parameters<typeof getLevelTestAssessment>[0],
): LevelTestScores {
  return Object.fromEntries(
    getLevelTestAssessment(input).flatMap(({ posterior, complete, unknownStreak, skill }) =>
      complete ? [[skill, unknownStreak ? 0 : Math.floor(getLowerBound(posterior))]] : [],
    ),
  );
}

export function getLevelTestRanges(
  input: Parameters<typeof getLevelTestAssessment>[0],
): LevelTestRanges {
  return Object.fromEntries(
    getLevelTestAssessment(input).flatMap(({ posterior, complete, unknownStreak, skill }) =>
      complete
        ? [
            [
              skill,
              {
                high: unknownStreak ? "A1" : CEFR_LEVELS[Math.ceil(getUpperBound(posterior))],
                low: unknownStreak ? "A1" : CEFR_LEVELS[Math.floor(getLowerBound(posterior))],
              },
            ],
          ]
        : [],
    ),
  );
}

export function listLevelTestLevels(
  scores: LevelTestScores,
): { label: string; score: number; skill: LanguageSkill }[] {
  const byId: Partial<Record<LanguageSkill, number>> = scores;

  return LANGUAGE_SKILLS.flatMap((skill) => {
    const score = byId[skill];
    return score === undefined ? [] : [{ label: formatCefrScore(score), score, skill }];
  });
}

export function toLevelLabels(scores: LevelTestScores): Partial<Record<LanguageSkill, string>> {
  return Object.fromEntries(listLevelTestLevels(scores).map((level) => [level.skill, level.label]));
}
