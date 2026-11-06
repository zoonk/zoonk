import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type CompareReleaseLessonsParams,
  type ReleaseComparison,
  compareReleaseLessons,
} from "@zoonk/ai/tasks/products/compare-release-lessons";
import { findEmDashes } from "@zoonk/utils/text-flaws";
import { TEST_CASES } from "./test-cases";

export type CompareReleaseLessonsInput = CompareReleaseLessonsParams;

export type CompareReleaseLessonsExpected = {
  /** Lessons the release makes wrong, which must be flagged. */
  changed: number[];
  /** Lessons the release leaves right, which must not be flagged. */
  unchanged: number[];
  whatsNew: boolean;
  titleIncludes?: string;
  titleExcludes?: string;
};

const MIN_SCORE = 6;
const SCORE_RANGE = 4;
const MAX_OFFER_LENGTH = 160;
const MAX_SKILLS = 4;

function listWhatsNewChecks({
  expected,
  output,
}: {
  expected: CompareReleaseLessonsExpected;
  output: ReleaseComparison;
}) {
  const { whatsNew } = output;

  if (!expected.whatsNew || !whatsNew) {
    return [{ label: `whatsNew ${expected.whatsNew}`, passed: !expected.whatsNew && !whatsNew }];
  }

  return [
    { label: "offer fits", passed: whatsNew.offer.length <= MAX_OFFER_LENGTH },
    { label: "1 to 4 skills", passed: whatsNew.skills.length <= MAX_SKILLS },
    ...(expected.titleIncludes
      ? [
          {
            label: `title names ${expected.titleIncludes}`,
            passed: whatsNew.title.includes(expected.titleIncludes),
          },
        ]
      : []),
    ...(expected.titleExcludes
      ? [
          {
            label: `title without ${expected.titleExcludes}`,
            passed: !whatsNew.title.includes(expected.titleExcludes),
          },
        ]
      : []),
  ];
}

function listChecks({
  expected,
  output,
}: {
  expected: CompareReleaseLessonsExpected;
  output: ReleaseComparison;
}) {
  const flagged = new Set(output.changed.map((entry) => entry.lesson));

  return [
    ...expected.changed.map((lesson) => ({
      label: `lesson ${lesson} changed`,
      passed: flagged.has(lesson),
    })),
    ...expected.unchanged.map((lesson) => ({
      label: `lesson ${lesson} kept`,
      passed: !flagged.has(lesson),
    })),
    ...listWhatsNewChecks({ expected, output }),
    { label: "no em dashes", passed: findEmDashes(output).length === 0 },
  ];
}

const scoreComparison: TaskScorer<CompareReleaseLessonsExpected> = ({ output, testCase }) => {
  const expected = testCase.expected;
  let parsed: ReleaseComparison | null = null;

  try {
    parsed = JSON.parse(output) as ReleaseComparison;
  } catch {
    parsed = null;
  }

  if (!parsed || !expected) {
    return createFixedScore({ conclusion: "No comparison", score: MIN_SCORE });
  }

  const checks = listChecks({ expected, output: parsed });
  const failed = checks.filter((check) => !check.passed).map((check) => check.label);

  return createFixedScore({
    conclusion: failed.length === 0 ? "None" : `Wrong: ${failed.join("; ")}`,
    score: MIN_SCORE + (SCORE_RANGE * (checks.length - failed.length)) / checks.length,
  });
};

export const compareReleaseLessonsTask: Task<
  CompareReleaseLessonsInput,
  ReleaseComparison,
  CompareReleaseLessonsExpected
> = {
  description:
    "Compare a product release's notes with a course's lessons: the lessons it makes wrong and the What's new chapter it calls for",
  generate: compareReleaseLessons,
  id: "compare-release-lessons",
  name: "Compare Release Lessons",
  score: scoreComparison,
  testCases: TEST_CASES,
};
