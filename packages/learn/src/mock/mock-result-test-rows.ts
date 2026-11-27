import { type MockResult } from "@zoonk/core/exams/mocks/contract";

export type MockPoints = NonNullable<MockResult["points"]>;
export type Tally = Omit<MockPoints, "parts" | "unjudged">;
export type TestRow = Tally & { name: string | null; qualifying: boolean };
export type WrittenPart = NonNullable<MockPoints["written"]>[number];

/** The written parts with something to say here: an estimate, or a minimum still to reach. */
export function getWrittenRows(points: MockPoints): WrittenPart[] {
  return (points.written ?? []).filter((part) => part.range || part.minimum);
}

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

export function hasTestRows(points: MockPoints | null | undefined): points is MockPoints {
  return Boolean(
    points &&
    (points.parts.length > 0 ||
      points.minimum ||
      points.unjudged.length > 0 ||
      getWrittenRows(points).length > 0),
  );
}

/**
 * True when the mock exam checked at least one minimum and every one was reached. A written part's
 * minimum is at best likely reached, so a mock with one never says every minimum was.
 */
export function reachedEveryMinimum(points: MockPoints | null | undefined): boolean {
  const rows = hasTestRows(points) ? toTestRows(points) : [];

  return (
    rows.some((row) => row.met === true) &&
    rows.every((row) => row.met !== false) &&
    !points?.written?.some((part) => part.minimum)
  );
}
