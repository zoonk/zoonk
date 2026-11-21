import { answerKeyEvidence } from "@/lib/answer-key-evidence";
import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import { type FindMistakePatternSchema } from "@zoonk/ai/tasks/language/mistake-pattern";
import { isWellFormedDrillQuestion } from "@zoonk/ai/tasks/language/mistake-pattern-rules";
import { MISTAKE_PATTERN_SCORE_CATEGORIES } from "./score-categories";

export type MistakePatternExpected = Pick<FindMistakePatternSchema, "kind" | "mistakeNumbers">;

const MIN_PATTERN_MISTAKES = 2;

const MAX_UNLABELED_MISTAKES = 1;

function checkMistakeNumbers({
  expected,
  output,
}: {
  expected: MistakePatternExpected;
  output: FindMistakePatternSchema;
}): boolean {
  const labeled = new Set(expected.mistakeNumbers);
  const found = output.mistakeNumbers.filter((number) => labeled.has(number)).length;
  const unlabeled = output.mistakeNumbers.length - found;

  if (expected.kind === "none") {
    return output.mistakeNumbers.length === 0;
  }

  const minFound = expected.kind === "pattern" ? MIN_PATTERN_MISTAKES : 1;
  return found >= minFound && unlabeled <= MAX_UNLABELED_MISTAKES;
}

function checkDrill({
  expected,
  output,
}: {
  expected: MistakePatternExpected;
  output: FindMistakePatternSchema;
}): boolean {
  if (expected.kind !== "pattern") {
    return output.drill.length === 0;
  }

  return (
    output.drill.length > 0 && output.drill.every((question) => isWellFormedDrillQuestion(question))
  );
}

function checkMistakePattern({
  expected,
  output,
}: {
  expected: MistakePatternExpected;
  output: string;
}): CodeCheckResult {
  const parsed = JSON.parse(output) as FindMistakePatternSchema;

  const checks = [
    {
      criterion: "rule",
      passed: parsed.kind === expected.kind,
      problem: `Kind is ${parsed.kind} instead of ${expected.kind}.`,
    },
    {
      criterion: "rule",
      passed: checkMistakeNumbers({ expected, output: parsed }),
      problem: `Mistake numbers [${parsed.mistakeNumbers.join(", ")}] don't match the labeled [${expected.mistakeNumbers.join(", ")}].`,
    },
    {
      criterion: "drill",
      passed: checkDrill({ expected, output: parsed }),
      problem:
        expected.kind === "pattern"
          ? `The drill has ${parsed.drill.length} questions or a malformed one.`
          : "A drill was written without a pattern.",
    },
  ];

  const failed = checks.filter((check) => !check.passed);

  return {
    criteria: [...new Set(failed.map((check) => check.criterion))],
    judgedOutput: output,
    ...answerKeyEvidence((label) => ({
      ...parsed,
      drill: parsed.drill.map((question, index) => label(question, `drill[${index}]`)),
    })),
    passed: checks.length - failed.length,
    problems: failed.map((check) => check.problem),
    total: checks.length,
  };
}

export const checkMistakePatternOutput: TaskCodeChecks<MistakePatternExpected> = ({
  output,
  testCase,
}) => {
  const { expected } = testCase;

  if (!expected) {
    throw new Error(`Test case ${testCase.id} needs a labeled kind.`);
  }

  return checkMistakePattern({ expected, output });
};

export const scoreMistakePattern: TaskScorer<MistakePatternExpected> = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkMistakePatternOutput({ output: value, testCase }),
    output,
    scoreCategories: MISTAKE_PATTERN_SCORE_CATEGORIES,
    testCase,
  });
