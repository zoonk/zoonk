import { type MockResult } from "@zoonk/core/exams/mocks/contract";

export type MockPoints = NonNullable<MockResult["points"]>;
export type Tally = Omit<MockPoints, "parts" | "unjudged">;
export type TestRow = Tally & { name: string | null; qualifying: boolean };

/**
 * Misses first, so what would eliminate the learner is read before what went fine. The total joins
 * the tests when it has a minimum to judge, or when a missed minimum takes the result's headline,
 * which is where the total showed.
 */
export function toTestRows(points: MockPoints): TestRow[] {
  const headlineTaken = points.parts.some((part) => part.met === false);

  const total =
    points.minimum || headlineTaken ? [{ ...points, name: null, qualifying: false }] : [];

  const rows = [...points.parts, ...total];

  return [...rows.filter((row) => row.met === false), ...rows.filter((row) => row.met !== false)];
}
