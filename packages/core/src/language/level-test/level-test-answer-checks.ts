import {
  type LevelTestBank,
  type LevelTestProgress,
  type LevelTestQuestion,
} from "./level-test-contract";
import { estimatePooledScore, getBand, getLevelTestScores } from "./level-test-rules";

// The thresholds come from simulating the test's own selection and scoring (#2684): they caught
// wrong keys and labels two bands too high while removing about one good question per 50 banks.
export const MIN_GROUP = 20;
const MIN_OTHER_ANSWERS = 3;
const MIN_GAP_ANSWERS = 4;
const RIVAL_SHARE = 2 / 3;
const RIGHT_BELOW_SHARE = 0.9;

/** A learner's other skill stands in for the one a question tests, which a wide gap makes wrong. */
const MAX_SKILL_GAP = 0.5;

type JudgedLevelTest = { answers: LevelTestProgress["answers"]; startScore: number };

export type RecordedLevelTest = {
  answers: Omit<LevelTestProgress["answers"][number], "correct">[];
  startScore: number;
};

export type LevelTestQuestionVerdict = {
  group: number;
  id: string;
  picks: number[];
  problem: "easierThanItsLevel" | "wrongKey";
};

/** Each answer next to the level the learner showed on everything else in their test. */
type JudgedAnswer = { answerIndex: number | null; rest: number };

function getSkillGap({ bank, tests }: { bank: LevelTestBank; tests: JudgedLevelTest[] }) {
  const gaps = tests.flatMap(({ answers, startScore }) => {
    if (estimatePooledScore({ answers, bank, start: startScore }).answered < MIN_GAP_ANSWERS) {
      return [];
    }

    const scores = getLevelTestScores({
      bank,
      progress: { answers, speaking: null },
      start: startScore,
    });

    return [scores.listening - scores.reading];
  });

  return gaps.length === 0 ? 0 : gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
}

function judgeAnswers({
  bank,
  question,
  tests,
}: {
  bank: LevelTestBank;
  question: LevelTestQuestion;
  tests: JudgedLevelTest[];
}): JudgedAnswer[] {
  return tests.flatMap(({ answers, startScore }) =>
    answers.flatMap((answer, index) => {
      if (answer.id !== question.id || answer.skipped) {
        return [];
      }

      const others = answers.filter((_, other) => other !== index);
      const rest = estimatePooledScore({ answers: others, bank, start: startScore });

      return rest.answered < MIN_OTHER_ANSWERS
        ? []
        : [{ answerIndex: answer.answerIndex, rest: rest.score }];
    }),
  );
}

function countPicks({
  answers,
  question,
}: {
  answers: JudgedAnswer[];
  question: LevelTestQuestion;
}) {
  return question.options.map(
    (_, option) => answers.filter((answer) => answer.answerIndex === option).length,
  );
}

function judgeQuestion({
  answers,
  question,
}: {
  answers: JudgedAnswer[];
  question: LevelTestQuestion;
}): LevelTestQuestionVerdict | null {
  const band = getBand(question.level);
  const atLevel = answers.filter((answer) => answer.rest >= band);
  const atLevelPicks = countPicks({ answers: atLevel, question });
  const rival = Math.max(...atLevelPicks.filter((_, option) => option !== question.answerIndex));

  if (atLevel.length >= MIN_GROUP && rival >= atLevel.length * RIVAL_SHARE) {
    return { group: atLevel.length, id: question.id, picks: atLevelPicks, problem: "wrongKey" };
  }

  const below = answers.filter((answer) => answer.rest <= band - 1);
  const belowPicks = countPicks({ answers: below, question });
  const right = belowPicks[question.answerIndex] ?? 0;

  if (below.length >= MIN_GROUP && right >= below.length * RIGHT_BELOW_SHARE) {
    return {
      group: below.length,
      id: question.id,
      picks: belowPicks,
      problem: "easierThanItsLevel",
    };
  }

  return null;
}

/** Checking the bank's keys judges every answer by the key as it is now. */
function judgeByKey({
  bank,
  test,
}: {
  bank: LevelTestBank;
  test: RecordedLevelTest;
}): JudgedLevelTest {
  const keys = new Map(bank.questions.map((question) => [question.id, question.answerIndex]));

  return {
    ...test,
    answers: test.answers.map((answer) => ({
      ...answer,
      correct: answer.answerIndex === null ? null : answer.answerIndex === keys.get(answer.id),
    })),
  };
}

/**
 * The bank's questions that learners' answers show to be wrong: a key learners at its level
 * mostly reject for one other option, or a level learners a band below mostly pass.
 */
export function findWrongLevelTestQuestions({
  bank,
  tests: recorded,
}: {
  bank: LevelTestBank;
  tests: RecordedLevelTest[];
}): { skillGap: number; verdicts: LevelTestQuestionVerdict[] } {
  const tests = recorded.map((test) => judgeByKey({ bank, test }));
  const skillGap = getSkillGap({ bank, tests });

  if (Math.abs(skillGap) >= MAX_SKILL_GAP) {
    return { skillGap, verdicts: [] };
  }

  const verdicts = bank.questions.flatMap((question) => {
    const verdict = judgeQuestion({ answers: judgeAnswers({ bank, question, tests }), question });
    return verdict ? [verdict] : [];
  });

  return { skillGap, verdicts };
}
