import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  MAX_PLAN_DAYS,
  assertTargetDates,
  getTargetDateBounds,
  isInputRangeError,
} from "./target-date-range";

const TODAY = "2026-10-14";

function catchRangeError(run: () => void): z.ZodError | null {
  try {
    run();
    return null;
  } catch (error) {
    if (isInputRangeError(error)) {
      return error;
    }

    throw error;
  }
}

describe(getTargetDateBounds, () => {
  it("runs from tomorrow to the last day a run plans from today", () => {
    expect(getTargetDateBounds(TODAY)).toStrictEqual({ max: "2036-10-11", min: "2026-10-15" });
    expect(MAX_PLAN_DAYS).toBe(3650);
  });

  it("counts calendar days across leap days and the year's end", () => {
    expect(getTargetDateBounds("2027-12-31")).toStrictEqual({
      max: "2037-12-28",
      min: "2028-01-01",
    });

    expect(getTargetDateBounds("2028-02-28").min).toBe("2028-02-29");
  });
});

describe(isInputRangeError, () => {
  it("tells a refused date from any other ZodError, which Zod's instanceof can't", () => {
    const refused = catchRangeError(() =>
      assertTargetDates({ targets: [{ path: ["d"], targetDate: "2040-01-01" }], today: TODAY }),
    );

    expect(isInputRangeError(refused)).toBe(true);
    expect(isInputRangeError(new z.ZodError([]))).toBe(false);
  });
});

describe(assertTargetDates, () => {
  it("takes the last day and refuses the one after it, at the date's own path", () => {
    expect(() =>
      assertTargetDates({
        targets: [{ path: ["targetDate"], targetDate: "2036-10-11" }],
        today: TODAY,
      }),
    ).not.toThrow();

    const error = catchRangeError(() =>
      assertTargetDates({
        targets: [{ path: ["goals", 1, "targetDate"], targetDate: "2036-10-12" }],
        today: TODAY,
      }),
    );

    expect(error).toBeInstanceOf(z.ZodError);

    expect(error?.issues).toMatchObject([
      {
        code: "custom",
        params: { bound: "latest", limit: "2036-10-11" },
        path: ["goals", 1, "targetDate"],
      },
    ]);
  });

  it("refuses today and earlier days unless the planner answers for them", () => {
    const error = catchRangeError(() =>
      assertTargetDates({ targets: [{ path: ["targetDate"], targetDate: TODAY }], today: TODAY }),
    );

    expect(error?.issues).toMatchObject([
      { params: { bound: "earliest", limit: "2026-10-15" }, path: ["targetDate"] },
    ]);

    expect(() =>
      assertTargetDates({
        latestOnly: true,
        targets: [{ path: ["targetDate"], targetDate: "2020-01-01" }],
        today: TODAY,
      }),
    ).not.toThrow();
  });

  it("never judges no date, an absent one or the goal's own date again", () => {
    expect(() =>
      assertTargetDates({
        targets: [
          { path: ["a"], targetDate: null },
          { path: ["b"], targetDate: undefined },
          { current: "2020-01-01", path: ["c"], targetDate: "2020-01-01" },
          { current: "2040-01-01", path: ["d"], targetDate: "2040-01-01" },
        ],
        today: TODAY,
      }),
    ).not.toThrow();
  });
});
