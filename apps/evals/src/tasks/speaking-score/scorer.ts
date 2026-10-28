import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import {
  type SpeakingCriterion,
  type SpeakingGrade,
  listRatedCriteria,
} from "@zoonk/ai/tasks/v2/language/speaking-bands";
import { SPEAKING_SCORE_CATEGORIES } from "./score-categories";
import { type SpeakingScoreInput } from "./test-inputs";

type BandWindow = { bandLow: number; bandHigh: number };

export type SpeakingScoreExpected = BandWindow & {
  brief?: boolean;
  criteria?: Record<string, BandWindow>;
};

type Grade = SpeakingGrade["criteria"][number];

const WINDOW_TOLERANCE = 0.5;
const MAX_RANGE_WIDTH = 1;
const HALF = 0.5;

function isOnScale({ criterion, grade }: { criterion: SpeakingCriterion; grade: Grade }) {
  const step = criterion.halfBands ? HALF : 1;
  const { bandHigh, bandLow } = grade;

  return (
    Number.isInteger(bandLow / step) &&
    Number.isInteger(bandHigh / step) &&
    bandLow >= (criterion.minBand ?? 0) &&
    bandLow <= bandHigh &&
    bandHigh <= Math.min(criterion.maxBand, bandLow + MAX_RANGE_WIDTH)
  );
}

function getCriterionProblem({
  criterion,
  expected,
  grades,
}: {
  criterion: SpeakingCriterion;
  expected: SpeakingScoreExpected;
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

function checkGrade({
  criteria,
  expected,
  output,
}: {
  criteria: readonly SpeakingCriterion[];
  expected: SpeakingScoreExpected;
  output: string;
}): CodeCheckResult {
  const grade = JSON.parse(output) as SpeakingGrade;

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

export const scoreSpeakingOutput: TaskScorer<SpeakingScoreExpected> = ({ output, testCase }) => {
  const { expected } = testCase;
  const input = testCase.userInput as SpeakingScoreInput;
  const criteria = listRatedCriteria(input);

  if (!expected) {
    throw new Error(`Test case ${testCase.id} needs an expected band window.`);
  }

  return scoreWithCodeChecks({
    check: (value) => checkGrade({ criteria, expected, output: value }),
    output,
    scoreCategories: SPEAKING_SCORE_CATEGORIES,
    testCase,
  });
};
