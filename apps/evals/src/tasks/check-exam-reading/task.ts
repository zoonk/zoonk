import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { type ReadingProblem } from "@zoonk/core/library/exams/blueprint-contract";
import { normalizeString } from "@zoonk/utils/string";
import {
  type CheckReadingEvalInput,
  type CheckReadingEvalOutput,
  generateReadingCheck,
} from "./generate";
import { TEST_CASES } from "./test-cases";

export type CheckReadingExpected = {
  /** Counts the reading lost, each on its subject as the reading named it: each must be found. */
  counts: { questions: number; subject: string }[];
  /** Subjects the reading left out, each as the words any of its names contains. */
  missing: string[][];
};

function parseOutput(output: string): CheckReadingEvalOutput | null {
  try {
    return JSON.parse(output) as CheckReadingEvalOutput;
  } catch {
    return null;
  }
}

function isExpectedSubject({ alternatives, name }: { alternatives: string[]; name: string }) {
  return alternatives.some((words) => normalizeString(name).includes(words));
}

function describe(problem: ReadingProblem): string {
  if (problem.kind === "missingSubject") {
    return `subject "${problem.name}"`;
  }

  if (problem.kind === "unconfirmed") {
    return `unconfirmed ${problem.subject ?? problem.part}`;
  }

  return problem.kind === "missingCount"
    ? `${problem.questions} for "${problem.subject}"`
    : `${problem.sum} of ${problem.total}`;
}

/** Expected findings the kept problems lack, and kept problems no expected finding explains. */
function compare({
  expected,
  problems,
}: {
  expected: CheckReadingExpected;
  problems: readonly ReadingProblem[];
}) {
  const missed = [
    ...expected.missing
      .filter(
        (alternatives) =>
          !problems.some(
            (problem) =>
              problem.kind === "missingSubject" &&
              isExpectedSubject({ alternatives, name: problem.name }),
          ),
      )
      .map((alternatives) => `subject ${alternatives.join("/")}`),
    ...expected.counts
      .filter(
        (count) =>
          !problems.some(
            (problem) =>
              problem.kind === "missingCount" &&
              problem.questions === count.questions &&
              problem.subject === count.subject,
          ),
      )
      .map((count) => `${count.questions} for "${count.subject}"`),
  ];

  const wrong = problems.filter((problem) => {
    if (problem.kind === "missingSubject") {
      return !expected.missing.some((alternatives) =>
        isExpectedSubject({ alternatives, name: problem.name }),
      );
    }

    return (
      problem.kind === "missingCount" &&
      !expected.counts.some((count) => count.subject === problem.subject)
    );
  });

  return { missed, wrong };
}

/**
 * Scored on the problems research keeps (findings whose passage code found): 10 when they are
 * exactly what the reading left out; 8 when they add one that isn't, which only costs a needless
 * reading; 6 when one the reading left out is missed, which leaves a plan without a subject.
 */
const scoreReadingCheck: TaskScorer<CheckReadingExpected> = ({ output, testCase }) => {
  const parsed = parseOutput(output);
  const expected = testCase.expected;

  if (!parsed || !expected) {
    return createFixedScore({ conclusion: "No output", score: 6 });
  }

  const { missed, wrong } = compare({ expected, problems: parsed.problems });

  const found = `kept ${parsed.problems.length} of ${parsed.missingSubjects.length + parsed.statedCounts.length} findings`;

  if (missed.length > 0) {
    return createFixedScore({ conclusion: `Missed ${missed.join("; ")} (${found})`, score: 6 });
  }

  if (wrong.length > 0) {
    return createFixedScore({
      conclusion: `Not missing: ${wrong.map((problem) => describe(problem)).join("; ")} (${found})`,
      score: 8,
    });
  }

  return createFixedScore({ conclusion: `None (${found})`, score: 10 });
};

export const checkExamReadingTask: Task<
  CheckReadingEvalInput,
  CheckReadingEvalOutput,
  CheckReadingExpected
> = {
  description:
    "Find what a reading of an exam's notice left out: a subject the notice says it covers, or a count it states",
  generate: generateReadingCheck,
  id: "check-exam-reading",
  name: "Check Exam Reading",
  score: scoreReadingCheck,
  testCases: TEST_CASES,
};
