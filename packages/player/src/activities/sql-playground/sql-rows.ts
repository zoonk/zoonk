import { type ActivityCell } from "@zoonk/core/library/activities/expected-answer";

type Rows = readonly (readonly ActivityCell[])[];

function rowKey(row: readonly ActivityCell[]): string {
  return JSON.stringify(row);
}

/**
 * Which result rows are also expected, and which expected rows the result is missing, compared
 * the way grading compares them: row by row in order when order matters, as a set otherwise.
 */
export function compareRows({
  actual,
  expected,
  orderMatters,
}: {
  actual: Rows;
  expected: Rows;
  orderMatters: boolean;
}): { actualMatched: boolean[]; expectedFound: boolean[] } {
  if (orderMatters) {
    return {
      actualMatched: actual.map(
        (row, index) => expected[index] !== undefined && rowKey(row) === rowKey(expected[index]),
      ),
      expectedFound: expected.map(
        (row, index) => actual[index] !== undefined && rowKey(row) === rowKey(actual[index]),
      ),
    };
  }

  const expectedKeys = new Set(expected.map((row) => rowKey(row)));
  const actualKeys = new Set(actual.map((row) => rowKey(row)));

  return {
    actualMatched: actual.map((row) => expectedKeys.has(rowKey(row))),
    expectedFound: expected.map((row) => actualKeys.has(rowKey(row))),
  };
}
