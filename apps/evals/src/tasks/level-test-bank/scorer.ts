import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import {
  type GenerateLevelTestBankSchema,
  LEVEL_TEST_PASSAGE_WORDS,
} from "@zoonk/ai/tasks/v2/language/level-test-bank";
import { LEVEL_TEST_BANK_SCORE_CATEGORIES } from "./score-categories";

type LevelTestQuestion = GenerateLevelTestBankSchema["questions"][number];

const TEST_LEVELS: LevelTestQuestion["level"][] = ["A1", "A2", "B1", "B2", "C1"];
const SKILLS: LevelTestQuestion["skill"][] = ["reading", "listening"];
const QUESTIONS_PER_SKILL = 2;
const OPTIONS_PER_QUESTION = 4;

function countWords(text: string): number {
  return text.split(/\s+/u).filter(Boolean).length;
}

function getQuestionProblems(question: LevelTestQuestion): string[] {
  const maxWords = LEVEL_TEST_PASSAGE_WORDS[question.level][question.skill].max;
  const words = countWords(question.passage);
  const label = `${question.level} ${question.skill}`;

  return [
    question.options.length !== OPTIONS_PER_QUESTION &&
      `${label}: ${question.options.length} options instead of ${OPTIONS_PER_QUESTION}.`,
    new Set(question.options.map((option) => option.trim())).size !== question.options.length &&
      `${label}: two options are the same.`,
    (!Number.isInteger(question.answerIndex) ||
      question.answerIndex < 0 ||
      question.answerIndex >= question.options.length) &&
      `${label}: answer index ${question.answerIndex} is out of range.`,
    words > maxWords && `${label}: the text has ${words} words, over ${maxWords}.`,
  ].filter((problem) => typeof problem === "string");
}

function getGroupProblems({
  bank,
  level,
  skill,
}: {
  bank: GenerateLevelTestBankSchema;
  level: LevelTestQuestion["level"];
  skill: LevelTestQuestion["skill"];
}): string[] {
  const questions = bank.questions.filter(
    (question) => question.level === level && question.skill === skill,
  );

  return [
    ...(questions.length === QUESTIONS_PER_SKILL
      ? []
      : [`${level} ${skill}: ${questions.length} questions instead of ${QUESTIONS_PER_SKILL}.`]),
    ...questions.flatMap((question) => getQuestionProblems(question)),
  ];
}

function getSpeakingProblems(bank: GenerateLevelTestBankSchema): string[] {
  return TEST_LEVELS.filter(
    (level) =>
      bank.speaking.filter((item) => item.level === level && item.sentence.trim()).length !== 1,
  ).map((level) => `${level} doesn't have exactly one sentence to say.`);
}

/**
 * Eleven parts: each level and skill has exactly two questions with four
 * distinct options, a valid answer index and a text no longer than its level
 * allows (the task's own limits, so the test still takes a few minutes), and
 * each level has one sentence to say.
 */
function checkLevelTestBank(output: string): CodeCheckResult {
  const bank = JSON.parse(output) as GenerateLevelTestBankSchema;

  const groups = TEST_LEVELS.flatMap((level) =>
    SKILLS.map((skill) => getGroupProblems({ bank, level, skill })),
  );

  const parts = [...groups, getSpeakingProblems(bank)];

  return {
    judgedOutput: output,
    passed: parts.filter((problems) => problems.length === 0).length,
    problems: parts.flat(),
    total: parts.length,
  };
}

export const scoreLevelTestBank: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: checkLevelTestBank,
    output,
    scoreCategories: LEVEL_TEST_BANK_SCORE_CATEGORIES,
    testCase,
  });
