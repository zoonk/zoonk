import { calculateScore } from "./score-calculation";
import { getBaseTestCaseId } from "./test-case-runs";
import { type EvalResult, type TestCase, type TestCaseOutput } from "./types";

const UNKNOWN_LANGUAGE = "other";

export type ReviewExportEntry = { language: string; output: string; testCaseId: string };

function normalizeLanguage(language: string): string {
  return language.trim().replaceAll("_", "-").toLowerCase();
}

function getOutputLanguage(testCase: TestCase): string {
  const language = testCase.userInput.language;

  if (typeof language === "string" && language.trim()) {
    return normalizeLanguage(language);
  }

  const [testCasePrefix] = getBaseTestCaseId(testCase.id).split("-");

  return testCasePrefix && /^[a-z]{2}$/iu.test(testCasePrefix)
    ? normalizeLanguage(testCasePrefix)
    : UNKNOWN_LANGUAGE;
}

function findLowestScoringResult({
  results,
  testCaseId,
}: {
  results: EvalResult[];
  testCaseId: string;
}): EvalResult | null {
  const matchingResults = results.filter(
    (result) => getBaseTestCaseId(result.testCase.id) === testCaseId,
  );

  if (matchingResults.length === 0) {
    return null;
  }

  return matchingResults.reduce((lowestResult, result) =>
    calculateScore({ categoryScores: result.categoryScores, steps: result.steps }) <
    calculateScore({ categoryScores: lowestResult.categoryScores, steps: lowestResult.steps })
      ? result
      : lowestResult,
  );
}

function getReviewOutput({
  outputs,
  results,
  testCaseId,
}: {
  outputs: TestCaseOutput[];
  results: EvalResult[];
  testCaseId: string;
}): Pick<TestCaseOutput, "output" | "testCase"> | null {
  const scoredOutput = findLowestScoringResult({ results, testCaseId });

  if (scoredOutput) {
    return scoredOutput;
  }

  return outputs.find((output) => getBaseTestCaseId(output.testCase.id) === testCaseId) ?? null;
}

function createReviewEntry({
  outputs,
  results,
  testCaseId,
}: {
  outputs: TestCaseOutput[];
  results: EvalResult[];
  testCaseId: string;
}): ReviewExportEntry[] {
  const reviewOutput = getReviewOutput({ outputs, results, testCaseId });

  return reviewOutput
    ? [
        {
          language: getOutputLanguage(reviewOutput.testCase),
          output: reviewOutput.output,
          testCaseId,
        },
      ]
    : [];
}

export function createReviewExportEntries({
  outputs,
  results,
}: {
  outputs: TestCaseOutput[];
  results: EvalResult[];
}): ReviewExportEntry[] {
  const testCaseIds = [...new Set(outputs.map((output) => getBaseTestCaseId(output.testCase.id)))];

  return testCaseIds.flatMap((testCaseId) => createReviewEntry({ outputs, results, testCaseId }));
}
