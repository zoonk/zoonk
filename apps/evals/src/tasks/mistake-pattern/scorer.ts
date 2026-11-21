import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
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

/** A learner reading the app in another language reads each sentence's translation under it. */
function hasExpectedTranslation({
  question,
  translated,
}: {
  question: FindMistakePatternSchema["drill"][number];
  translated: boolean;
}): boolean {
  return translated ? question.translation.trim() !== "" : question.translation === "";
}

function checkDrill({
  expected,
  output,
  translated,
}: {
  expected: MistakePatternExpected;
  output: FindMistakePatternSchema;
  translated: boolean;
}): boolean {
  if (expected.kind !== "pattern") {
    return output.drill.length === 0;
  }

  return (
    output.drill.length > 0 &&
    output.drill.every(
      (question) =>
        isWellFormedDrillQuestion(question) && hasExpectedTranslation({ question, translated }),
    )
  );
}

function checkMistakePattern({
  expected,
  output,
  translated,
}: {
  expected: MistakePatternExpected;
  output: string;
  translated: boolean;
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
      passed: checkDrill({ expected, output: parsed, translated }),
      problem:
        expected.kind === "pattern"
          ? `The drill has ${parsed.drill.length} questions, a malformed one or a missing or extra translation.`
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

  const translated = testCase.userInput.learnerLanguage !== testCase.userInput.targetLanguage;

  return scoreWithCodeChecks({
    check: (value) => checkMistakePattern({ expected, output: value, translated }),
    output,
    scoreCategories: MISTAKE_PATTERN_SCORE_CATEGORIES,
    testCase,
  });
};
