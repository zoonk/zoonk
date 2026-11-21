import { type LanguageSkill } from "@zoonk/db";
import {
  CEFR_LEVELS,
  type CefrLevel,
  MAX_CEFR_SCORE,
  clampCefrScore,
  formatCefrScore,
} from "@zoonk/utils/cefr";
import { isLowGuessTap } from "../../learner/_utils/placement-guess-rate";
import { LANGUAGE_SKILLS } from "../levels/skill-level-rules";
import {
  type Posterior,
  type ScoredAnswer,
  getDeviation,
  getLowerBound,
  getMean,
  getPosterior,
  getUpperBound,
} from "./_utils/level-test-posterior";
import {
  type LevelTestBank,
  type LevelTestConfirmation,
  type LevelTestLength,
  type LevelTestProgress,
  type LevelTestQuestion,
  type LevelTestRanges,
} from "./level-test-contract";

type TestAnswers = Pick<LevelTestProgress, "length" | "placement" | "result" | "speaking"> & {
  answers: readonly Pick<
    LevelTestProgress["answers"][number],
    "answerIndex" | "correct" | "id" | "skipped"
  >[];
};

const QUICK_QUESTIONS_PER_SKILL = 5;
const WHOLE_QUESTIONS_PER_SKILL = 16;
const WHOLE_STOP_SD = 0.45;
const QUESTION_SKILLS = ["reading", "listening"] as const;
export const LEVEL_TEST_TOTAL = QUICK_QUESTIONS_PER_SKILL * QUESTION_SKILLS.length;

const HALF_STEP = 0.5;
const CONFIRMATIONS_PER_SKILL = 2;

type QuestionSkill = (typeof QUESTION_SKILLS)[number];

export type LevelTestScores = Partial<Record<QuestionSkill | "speaking", number>>;

export function getBand(level: CefrLevel): number {
  return CEFR_LEVELS.indexOf(level);
}

export function levelTestTotal(length: LevelTestLength | undefined): number {
  return length === "wholeCourse"
    ? WHOLE_QUESTIONS_PER_SKILL * QUESTION_SKILLS.length
    : LEVEL_TEST_TOTAL;
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

  return { asked: asked.length, posterior: getPosterior({ answers: scored, start }), scored };
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

function canContinue({
  asked,
  length,
  posterior,
  scored,
}: ReturnType<typeof analyze> & { length: LevelTestLength | undefined }) {
  if (length !== "wholeCourse") {
    return asked < QUICK_QUESTIONS_PER_SKILL;
  }

  return (
    asked < WHOLE_QUESTIONS_PER_SKILL &&
    (scored.length < QUICK_QUESTIONS_PER_SKILL || getDeviation(posterior) > WHOLE_STOP_SD)
  );
}

function getConfirmations({
  bank,
  progress,
  floor,
}: {
  bank: LevelTestBank;
  progress: TestAnswers;
  floor: number;
}): { next: LevelTestConfirmation | null; through: CefrLevel | null } {
  const answers = new Map(progress.answers.map((answer) => [answer.id, answer]));
  const levels = CEFR_LEVELS.slice(0, floor + 1).toReversed();

  for (const level of levels) {
    const items = QUESTION_SKILLS.flatMap((skill) =>
      (bank.confirmations ?? [])
        .filter(
          (question) =>
            question.skill === skill &&
            question.level === level &&
            isLowGuessTap({
              content: { options: question.options, select: "all" },
              format: "multipleChoice",
            }),
        )
        .slice(0, CONFIRMATIONS_PER_SKILL),
    );

    if (
      new Set(items.map((question) => question.id)).size !==
      CONFIRMATIONS_PER_SKILL * QUESTION_SKILLS.length
    ) {
      return { next: null, through: null };
    }

    const missed = items.some(({ id }) => answers.has(id) && answers.get(id)?.correct !== true);

    if (!missed) {
      const next = items.find(({ id }) => !answers.has(id)) ?? null;
      return { next, through: next ? null : level };
    }
  }

  return { next: null, through: null };
}

function getAssessment({
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

function getProposedFloor(assessment: ReturnType<typeof getAssessment>) {
  if (assessment.some(({ scored }) => scored.length < QUICK_QUESTIONS_PER_SKILL)) {
    return -1;
  }

  return Math.floor(
    Math.min(...assessment.map(({ posterior }) => getLowerBound(posterior))) - HALF_STEP,
  );
}

export function getConfirmedLevel({
  bank,
  progress,
  start,
}: Parameters<typeof getAssessment>[0]): CefrLevel | null {
  return getConfirmations({
    bank,
    floor: getProposedFloor(getAssessment({ bank, progress, start })),
    progress,
  }).through;
}

export function getNextLevelTestStep({
  bank,
  progress,
  start,
}: Parameters<typeof getAssessment>[0]): LevelTestStep {
  if (progress.placement || progress.result) {
    return { kind: "done" };
  }

  const assessment = getAssessment({ bank, progress, start });
  const used = new Set(progress.answers.map((answer) => answer.id));

  const question = assessment
    .filter((item) => canContinue({ ...item, length: progress.length }))
    .toSorted((a, b) => a.asked - b.asked)
    .map(({ posterior, scored, skill }) =>
      pickQuestion({ bank, skill, target: getTargetBand({ posterior, scored, start }), used }),
    )
    .find((picked) => picked !== null);

  if (question) {
    return { kind: "question", question };
  }

  const { next } = getConfirmations({ bank, floor: getProposedFloor(assessment), progress });
  return next ? { kind: "confirmation", question: next } : { kind: "done" };
}

export function getLevelTestScores(input: Parameters<typeof getAssessment>[0]): LevelTestScores {
  return Object.fromEntries(
    getAssessment(input).flatMap(({ posterior, scored, skill }) =>
      scored.length > 0 ? [[skill, clampCefrScore(getMean(posterior))]] : [],
    ),
  );
}

export function getLevelTestRanges(input: Parameters<typeof getAssessment>[0]): LevelTestRanges {
  return Object.fromEntries(
    getAssessment(input).flatMap(({ posterior, scored, skill }) =>
      scored.length > 0
        ? [
            [
              skill,
              {
                high: CEFR_LEVELS[Math.ceil(getUpperBound(posterior))],
                low: CEFR_LEVELS[Math.floor(getLowerBound(posterior))],
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
