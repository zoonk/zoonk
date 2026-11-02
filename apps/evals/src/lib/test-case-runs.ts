import { type TestCase } from "./types";

type TestCaseRunProgress = { completedRuns: number; totalRuns: number };

export function getBaseTestCaseId(testCaseRunId: string): string {
  return testCaseRunId.replace(/-\d+$/u, "");
}

export function getTestCaseRunId({
  runNumber,
  testCaseId,
}: {
  runNumber: number;
  testCaseId: string;
}): string {
  return `${testCaseId}-${runNumber}`;
}

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
