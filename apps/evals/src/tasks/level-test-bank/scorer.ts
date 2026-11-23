import { scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import { type LevelTestQuestion } from "@zoonk/ai/tasks/language/level-test-bank";
import {
  LEVEL_TEST_LEVELS,
  LEVEL_TEST_PASSAGE_WORDS,
  LEVEL_TEST_SKILLS,
} from "@zoonk/ai/tasks/language/level-test-levels";
import { LEVEL_TEST_BANK_SCORE_CATEGORIES } from "./score-categories";

type LevelTestBankQuestions = { questions: LevelTestQuestion[] };
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
  bank: LevelTestBankQuestions;
  level: LevelTestQuestion["level"];
  skill: LevelTestQuestion["skill"];
}): string[] {
  const questions = bank.questions.filter(
    (question) => question.level === level && question.skill === skill,
  );

  return [
    ...(questions.length > 0 ? [] : [`${level} ${skill}: no questions.`]),
    ...questions.flatMap((question) => getQuestionProblems(question)),
  ];
}

function checkBankStructure(bank: LevelTestBankQuestions) {
  const parts = LEVEL_TEST_LEVELS.flatMap((level) =>
    LEVEL_TEST_SKILLS.map((skill) => getGroupProblems({ bank, level, skill })),
  );

  return {
    passed: parts.filter((problems) => problems.length === 0).length,
    problems: parts.flat(),
    total: parts.length,
  };
}

export const checkLevelTestBank: TaskCodeChecks = ({ output }) => {
  const bank = JSON.parse(output) as LevelTestBankQuestions;

  const questions = bank.questions.map((question, index) => ({
    ...question,
    itemLocator: `questions[${index}]`,
  }));

  return {
    ...checkBankStructure(bank),
    blockingProblems: questions.length === 0 ? ["No placement question passed its check."] : [],
    judgedOutput: JSON.stringify({ ...bank, questions }),
    keyFlawLocators: questions.map((question) => question.itemLocator),
  };
};

export const scoreLevelTestBank: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => ({
      ...checkBankStructure(JSON.parse(value) as LevelTestBankQuestions),
      judgedOutput: value,
    }),
    output,
    scoreCategories: LEVEL_TEST_BANK_SCORE_CATEGORIES,
    testCase,
  });
