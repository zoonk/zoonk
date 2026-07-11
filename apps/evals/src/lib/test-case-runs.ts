import { type TestCase } from "./types";

type TestCaseRunProgress = { completedRuns: number; totalRuns: number };

/**
 * Gives every generated run a stable id so generation, progress, and scoring
 * all refer to the same saved output entry.
 */
export function getTestCaseRunId({
  runNumber,
  testCaseId,
}: {
  runNumber: number;
  testCaseId: string;
}): string {
  return `${testCaseId}-${runNumber}`;
}

/**
 * Expands the current test case registry into the exact run ids that should
 * exist. Historical runs and outputs for removed cases are intentionally not
 * included because they must not make the current task look complete.
 */
function getExpectedTestCaseRunIds({
  runsPerTestCase,
  testCases,
}: {
  runsPerTestCase: number;
  testCases: Pick<TestCase, "id">[];
}): string[] {
  return testCases.flatMap((testCase) =>
    Array.from({ length: runsPerTestCase }, (_, runIndex) =>
      getTestCaseRunId({ runNumber: runIndex + 1, testCaseId: testCase.id }),
    ),
  );
}

/**
 * Counts only unique saved ids that are still required by the current task.
 * This keeps extra historical runs, removed cases, and duplicate entries from
 * inflating progress or incorrectly marking the task complete.
 */
export function getTestCaseRunProgress({
  completedRunIds,
  runsPerTestCase,
  testCases,
}: {
  completedRunIds: string[];
  runsPerTestCase: number;
  testCases: Pick<TestCase, "id">[];
}): TestCaseRunProgress {
  const completedRunIdSet = new Set(completedRunIds);
  const expectedRunIdSet = new Set(getExpectedTestCaseRunIds({ runsPerTestCase, testCases }));

  const completedRuns = [...expectedRunIdSet].filter((runId) =>
    completedRunIdSet.has(runId),
  ).length;

  return { completedRuns, totalRuns: expectedRunIdSet.size };
}
