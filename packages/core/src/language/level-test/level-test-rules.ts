import { type LanguageSkill } from "@zoonk/db";
import { CEFR_LEVELS, type CefrLevel, clampCefrScore, formatCefrScore } from "@zoonk/utils/cefr";
import { LANGUAGE_SKILLS } from "../levels/skill-level-rules";
import {
  type LevelTestBank,
  type LevelTestProgress,
  type LevelTestQuestion,
} from "./level-test-contract";

type TestAnswers = {
  answers: readonly Pick<LevelTestProgress["answers"][number], "answerIndex" | "id">[];
  speaking: LevelTestProgress["speaking"];
};

const QUESTIONS_PER_SKILL = 3;
const QUESTION_SKILLS = ["reading", "listening"] as const;
export const LEVEL_TEST_TOTAL = QUESTIONS_PER_SKILL * QUESTION_SKILLS.length + 1;

const GUESS_CHANCE = 0.25;
const SLOPE = 2.5;
const AT_LEVEL_OFFSET = 0.5;
const PRIOR_SPREAD = 1.5;
const HALF_STEP = 0.5;

const GRID_POINTS = 10;
const GRID = Array.from({ length: GRID_POINTS }, (_, index) => index * HALF_STEP);
const HIGHEST_BAND = 4;

const SPOKEN_WELL = 0.9;
const SPOKEN_MOSTLY = 0.6;

type QuestionSkill = (typeof QUESTION_SKILLS)[number];

export type LevelTestScores = Record<QuestionSkill, number> & { speaking?: number };

function getBand(level: CefrLevel): number {
  return CEFR_LEVELS.indexOf(level);
}

function logistic(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function knows(theta: number, band: number): number {
  return logistic(SLOPE * (theta - band + AT_LEVEL_OFFSET));
}

function getLikelihood({
  band,
  correct,
  theta,
}: {
  band: number;
  correct: boolean | null;
  theta: number;
}) {
  if (correct === null) {
    return 1 - knows(theta, band);
  }

  const right = GUESS_CHANCE + (1 - GUESS_CHANCE) * knows(theta, band);
  return correct ? right : 1 - right;
}

type ScoredAnswer = { band: number; correct: boolean | null };

function getPosterior({ answers, start }: { answers: ScoredAnswer[]; start: number }) {
  return GRID.map((theta) => {
    const prior = Math.exp(-((theta - start) ** 2) / (2 * PRIOR_SPREAD ** 2));

    return answers.reduce((weight, answer) => weight * getLikelihood({ ...answer, theta }), prior);
  });
}

function estimateSkillScore({ answers, start }: { answers: ScoredAnswer[]; start: number }) {
  if (answers.length === 0) {
    return start;
  }

  const weights = getPosterior({ answers, start });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return GRID.reduce((sum, theta, index) => sum + theta * (weights[index] ?? 0), 0) / total;
}

function getTargetBand({ answers, start }: { answers: ScoredAnswer[]; start: number }) {
  const weights = getPosterior({ answers, start });
  const likely = GRID[weights.indexOf(Math.max(...weights))] ?? start;
  const last = answers.at(-1);

  if (!last) {
    return Math.round(likely);
  }

  return last.correct ? Math.ceil(likely) : Math.floor(likely);
}

function scoreAnswers({
  bank,
  progress,
  skill,
}: {
  bank: LevelTestBank;
  progress: TestAnswers;
  skill: QuestionSkill;
}): ScoredAnswer[] {
  return progress.answers.flatMap((answer) => {
    const question = bank.questions.find((item) => item.id === answer.id && item.skill === skill);

    if (!question) {
      return [];
    }

    const correct =
      answer.answerIndex === null ? null : answer.answerIndex === question.answerIndex;

    return [{ band: getBand(question.level), correct }];
  });
}

function getSkillScore({
  bank,
  progress,
  skill,
  start,
}: {
  bank: LevelTestBank;
  progress: TestAnswers;
  skill: QuestionSkill;
  start: number;
}) {
  return estimateSkillScore({ answers: scoreAnswers({ bank, progress, skill }), start });
}

function pickQuestion({
  bank,
  progress,
  score,
  skill,
}: {
  bank: LevelTestBank;
  progress: TestAnswers;
  score: number;
  skill: QuestionSkill;
}): LevelTestQuestion | null {
  const used = new Set(progress.answers.map((answer) => answer.id));

  return (
    bank.questions
      .filter((question) => question.skill === skill && !used.has(question.id))
      .toSorted(
        (a, b) =>
          Math.abs(getBand(a.level) - score) - Math.abs(getBand(b.level) - score) ||
          getBand(a.level) - getBand(b.level),
      )[0] ?? null
  );
}

export type LevelTestStep =
  | { kind: "done" }
  | { kind: "question"; question: LevelTestQuestion }
  | { kind: "speaking"; speaking: LevelTestBank["speaking"][number] };

function pickSentence({
  bank,
  scores,
}: {
  bank: LevelTestBank;
  scores: Record<QuestionSkill, number>;
}) {
  const band = Math.min(HIGHEST_BAND, Math.floor(Math.min(scores.reading, scores.listening)));
  return bank.speaking.find((item) => getBand(item.level) === band) ?? bank.speaking[0] ?? null;
}

export function getNextLevelTestStep({
  bank,
  progress,
  start,
}: {
  bank: LevelTestBank;
  progress: TestAnswers;
  start: number;
}): LevelTestStep {
  const targets = {
    listening: getTargetBand({
      answers: scoreAnswers({ bank, progress, skill: "listening" }),
      start,
    }),
    reading: getTargetBand({ answers: scoreAnswers({ bank, progress, skill: "reading" }), start }),
  };

  const counts = QUESTION_SKILLS.map((skill) => ({
    count: scoreAnswers({ bank, progress, skill }).length,
    skill,
  }));

  const turn = counts
    .filter((item) => item.count < QUESTIONS_PER_SKILL)
    .toSorted((a, b) => a.count - b.count)[0];

  const question = turn
    ? pickQuestion({ bank, progress, score: targets[turn.skill], skill: turn.skill })
    : null;

  if (question) {
    return { kind: "question", question };
  }

  const scores = {
    listening: getSkillScore({ bank, progress, skill: "listening", start }),
    reading: getSkillScore({ bank, progress, skill: "reading", start }),
  };

  const sentence = progress.speaking ? null : pickSentence({ bank, scores });
  return sentence ? { kind: "speaking", speaking: sentence } : { kind: "done" };
}

function getSpeakingScore(progress: TestAnswers): number | null {
  if (!progress.speaking) {
    return null;
  }

  const band = getBand(progress.speaking.level);
  const { score } = progress.speaking;

  if (score >= SPOKEN_WELL) {
    return band + HALF_STEP;
  }

  return score >= SPOKEN_MOSTLY ? band : band - HALF_STEP;
}

export function getLevelTestScores({
  bank,
  progress,
  start,
}: {
  bank: LevelTestBank;
  progress: TestAnswers;
  start: number;
}): LevelTestScores {
  const reading = getSkillScore({ bank, progress, skill: "reading", start });
  const listening = getSkillScore({ bank, progress, skill: "listening", start });
  const speaking = getSpeakingScore(progress);

  const scores = { listening: clampCefrScore(listening), reading: clampCefrScore(reading) };

  return speaking === null ? scores : { ...scores, speaking: clampCefrScore(speaking) };
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

export function getOverallScore(scores: LevelTestScores): number {
  const values = listLevelTestLevels(scores).map((level) => level.score);
  return clampCefrScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}
