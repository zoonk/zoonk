import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { type WrittenTaskFact, hasGrading } from "../extract-exam-blueprint/written-grading-checks";
import {
  type WrittenGradingEvalInput,
  type WrittenGradingEvalOutput,
  generateWrittenGrading,
} from "./generate";
import { TEST_CASES } from "./test-cases";

/** Each task id's marking as the documents state it; a field left out isn't checked. */
export type WrittenGradingExpected = Record<string, Omit<WrittenTaskFact, "kind">>;

const MIN_SCORE = 2;
const SCORE_RANGE = 8;

function parseOutput(output: string): WrittenGradingEvalOutput | null {
  try {
    return JSON.parse(output) as WrittenGradingEvalOutput;
  } catch {
    return null;
  }
}

function checkTask({
  expected,
  input,
  output,
  task,
}: {
  expected: Omit<WrittenTaskFact, "kind">;
  input: WrittenGradingEvalInput;
  output: WrittenGradingEvalOutput;
  task: string;
}) {
  const found = output.tasks.find((entry) => entry.task === task);
  const points = input.tasks.find(({ id }) => id === task)?.points ?? null;

  const fields = hasGrading(
    { ...expected, kind: "writtenTask" },
    { grading: found?.grading ?? null, points },
  );

  const missing = found?.passages.missing ?? [];

  return [
    { name: `${task} fields`, passed: fields },
    {
      detail: missing.map((passage) => `"${passage.slice(0, 80)}"`).join("; "),
      name: `${task} cited ${(found?.passages.total ?? 0) - missing.length}/${found?.passages.total ?? 0}`,
      passed: missing.length === 0,
    },
  ];
}

const scoreWrittenGrading: TaskScorer<WrittenGradingExpected> = ({ output, testCase }) => {
  const parsed = parseOutput(output);
  const { expected } = testCase;

  if (!parsed?.tasks || !expected) {
    return createFixedScore({ conclusion: "Invalid output", score: MIN_SCORE });
  }

  const input = testCase.userInput as WrittenGradingEvalInput;

  const checks = Object.entries(expected).flatMap(([task, fact]) =>
    checkTask({ expected: fact, input, output: parsed, task }),
  );

  const passed = checks.filter((check) => check.passed).length;

  return createFixedScore({
    conclusion: checks
      .map(
        ({ detail, name, passed: ok }) =>
          `[${name}${ok ? "" : " FAIL"}]${detail ? ` ${detail}` : ""}`,
      )
      .join(" "),
    score: MIN_SCORE + (SCORE_RANGE * passed) / Math.max(1, checks.length),
  });
};

export const readWrittenGradingTask: Task<
  WrittenGradingEvalInput,
  WrittenGradingEvalOutput,
  WrittenGradingExpected
> = {
  description:
    "Read how an exam's documents say each written task is marked (criteria and points, scales, caps, language deduction, rounding, zero rules), each rule quoting its passage; code-checked against the documents",
  generate: generateWrittenGrading,
  id: "read-written-grading",
  name: "Read written grading",
  priorities: {
    distribution: "shared",
    first: "quality",
    reads: "The grader marks every learner's written answers on this sheet",
    reason:
      "A wrong criterion, scale or rule misgrades every answer to the task; a dropped passage leaves the task without a total",
    waits: "Prepared from the exam's documents before learners practice",
  },
  score: scoreWrittenGrading,
  testCases: TEST_CASES,
};
