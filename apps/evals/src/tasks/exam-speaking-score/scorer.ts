import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import {
  type ExamSpeakingCriterion,
  type ExamSpeakingGrade,
  listRatedCriteria,
} from "@zoonk/ai/tasks/v2/language/exam-speaking-bands";
import { EXAM_SPEAKING_SCORE_CATEGORIES } from "./score-categories";
import { type ExamSpeakingInput } from "./test-cases";

type BandWindow = { bandLow: number; bandHigh: number };

/**
 * The band window on the exam's own scale where a transcript written at a known level sits, for
 * every criterion unless `criteria` gives one its own (a candidate who covers every point of the
 * task rates higher on it than on language): DELE's band 2 is its level, Goethe's 2 and 3 are C
 * and B, Cambridge's 3 is its level. `brief`, when given, is whether there was too little to judge.
 */
export type ExamSpeakingExpected = BandWindow & {
  brief?: boolean;
  criteria?: Record<string, BandWindow>;
};

type Grade = ExamSpeakingGrade["criteria"][number];

/** Raters disagree by about half a band, so a range within half a band of the window counts. */
const WINDOW_TOLERANCE = 0.5;
const MAX_RANGE_WIDTH = 1;
const HALF = 0.5;

function isOnScale({ criterion, grade }: { criterion: ExamSpeakingCriterion; grade: Grade }) {
  const step = criterion.halfBands ? HALF : 1;
  const { bandHigh, bandLow } = grade;

  return (
    Number.isInteger(bandLow / step) &&
    Number.isInteger(bandHigh / step) &&
    bandLow >= 0 &&
    bandLow <= bandHigh &&
    bandHigh <= Math.min(criterion.maxBand, bandLow + MAX_RANGE_WIDTH)
  );
}

function getCriterionProblem({
  criterion,
  expected,
  grades,
}: {
  criterion: ExamSpeakingCriterion;
  expected: ExamSpeakingExpected;
  grades: readonly Grade[];
}): string | null {
  const matches = grades.filter((grade) => grade.criterion === criterion.key);
  const [grade] = matches;

  if (!grade || matches.length > 1) {
    return `${criterion.key} appears ${matches.length} times instead of once.`;
  }

  if (!isOnScale({ criterion, grade })) {
    return `${criterion.key} has an invalid range ${grade.bandLow} to ${grade.bandHigh}.`;
  }

  if (criterion.sound && grade.bandHigh - grade.bandLow !== 1) {
    return `${criterion.key} rates sound from a transcript, so its range must be one band wide.`;
  }

  const window = expected.criteria?.[criterion.key] ?? expected;

  const near =
    grade.bandLow <= window.bandHigh + WINDOW_TOLERANCE &&
    grade.bandHigh >= window.bandLow - WINDOW_TOLERANCE;

  return near
    ? null
    : `${criterion.key} is ${grade.bandLow} to ${grade.bandHigh}, outside ${window.bandLow} to ${window.bandHigh} (plus or minus ${WINDOW_TOLERANCE}).`;
}

/**
 * Each criterion the task can be rated on is one part (typed replies leave out what only the voice
 * shows), the focus naming one of them is another, and so is `brief` when the case expects one.
 */
function checkGrade({
  criteria,
  expected,
  output,
}: {
  criteria: readonly ExamSpeakingCriterion[];
  expected: ExamSpeakingExpected;
  output: string;
}): CodeCheckResult {
  const grade = JSON.parse(output) as ExamSpeakingGrade;

  const problems = [
    ...criteria.map((criterion) =>
      getCriterionProblem({ criterion, expected, grades: grade.criteria }),
    ),
    criteria.some((criterion) => criterion.key === grade.focus)
      ? null
      : `The focus "${grade.focus}" isn't one of the task's criteria.`,
    expected.brief === undefined || grade.brief === expected.brief
      ? null
      : `brief is ${String(grade.brief)}, expected ${String(expected.brief)}.`,
  ].filter((problem) => problem !== null);

  const total = criteria.length + (expected.brief === undefined ? 1 : 2);
  return { judgedOutput: output, passed: total - problems.length, problems, total };
}

/**
 * Code checks the bands on each exam's own scale against transcripts written at a known level;
 * the judge scores the evidence, the tips and that nothing marks down an accent or promises a pass.
 */
export const scoreExamSpeakingOutput: TaskScorer<ExamSpeakingExpected> = ({ output, testCase }) => {
  const { expected } = testCase;
  const input = testCase.userInput as ExamSpeakingInput;
  const criteria = listRatedCriteria(input);

  if (!expected) {
    throw new Error(`Test case ${testCase.id} needs an expected band window.`);
  }

  return scoreWithCodeChecks({
    check: (value) => checkGrade({ criteria, expected, output: value }),
    output,
    scoreCategories: EXAM_SPEAKING_SCORE_CATEGORIES,
    testCase,
  });
};
