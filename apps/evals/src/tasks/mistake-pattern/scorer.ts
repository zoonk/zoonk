import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import { type FindMistakePatternSchema } from "@zoonk/ai/tasks/v2/language/mistake-pattern";
import { isWellFormedDrillQuestion } from "@zoonk/ai/tasks/v2/language/mistake-pattern-rules";
import { MISTAKE_PATTERN_SCORE_CATEGORIES } from "./score-categories";

/** The labeled kind and the mistakes that show it (for typos, the slips). */
export type MistakePatternExpected = Pick<FindMistakePatternSchema, "kind" | "mistakeNumbers">;

const DRILL_QUESTIONS = 5;
const MIN_PATTERN_MISTAKES = 2;

/** A pattern may pull in one borderline mistake the label left out, but no more. */
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
    output.drill.length === DRILL_QUESTIONS &&
    output.drill.every((question) => isWellFormedDrillQuestion(question))
  );
}

/**
 * Three parts: the kind matches the label, the mistake numbers point at the
 * labeled mistakes, and the drill is five well-formed questions for a pattern
 * (none otherwise). A wrong kind usually fails all three, which skips the judge.
 */
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
      passed: parsed.kind === expected.kind,
      problem: `Kind is ${parsed.kind} instead of ${expected.kind}.`,
    },
    {
      passed: checkMistakeNumbers({ expected, output: parsed }),
      problem: `Mistake numbers [${parsed.mistakeNumbers.join(", ")}] don't match the labeled [${expected.mistakeNumbers.join(", ")}].`,
    },
    {
      passed: checkDrill({ expected, output: parsed }),
      problem:
        expected.kind === "pattern"
          ? `The drill has ${parsed.drill.length} questions or a malformed one instead of ${DRILL_QUESTIONS} well-formed questions.`
          : "A drill was written without a pattern.",
    },
  ];

  return {
    judgedOutput: output,
    passed: checks.filter((check) => check.passed).length,
    problems: checks.filter((check) => !check.passed).map((check) => check.problem),
    total: checks.length,
  };
}

export const scoreMistakePattern: TaskScorer<MistakePatternExpected> = ({ output, testCase }) => {
  const { expected } = testCase;

  if (!expected) {
    throw new Error(`Test case ${testCase.id} needs a labeled kind.`);
  }

  return scoreWithCodeChecks({
    check: (value) => checkMistakePattern({ expected, output: value }),
    output,
    scoreCategories: MISTAKE_PATTERN_SCORE_CATEGORIES,
    testCase,
  });
};
