import { describe, expect, test } from "vitest";
import { getSettledFailureError, settledFailures, throwSettledFailures } from "./settled";

describe(settledFailures, () => {
  test("returns every rejected reason and fulfilled error", () => {
    const rejectedError = new Error("rejected");
    const fulfilledError = new Error("fulfilled error");
    const results: PromiseSettledResult<unknown>[] = [
      { status: "fulfilled", value: "ok" },
      { reason: rejectedError, status: "rejected" },
      { status: "fulfilled", value: { data: null, error: fulfilledError } },
    ];

    expect(settledFailures(results)).toEqual([rejectedError, fulfilledError]);
  });

  test("returns an empty array when nothing failed", () => {
    const results: PromiseSettledResult<unknown>[] = [
      { status: "fulfilled", value: "ok" },
      { status: "fulfilled", value: { data: "ok", error: null } },
    ];

    expect(settledFailures(results)).toEqual([]);
  });
});

describe(getSettledFailureError, () => {
  test("returns null when there are no failures", () => {
    expect(getSettledFailureError({ failures: [], message: "failed" })).toBeNull();
  });

  test("returns the original error when exactly one operation failed", () => {
    const error = new Error("single");

    expect(getSettledFailureError({ failures: [error], message: "failed" })).toBe(error);
  });

  test("returns AggregateError when multiple operations failed", () => {
    const errors = [new Error("first"), new Error("second")];
    const error = getSettledFailureError({ failures: errors, message: "multiple failed" });

    expect(error).toBeInstanceOf(AggregateError);
    expect(error).toMatchObject({ errors, message: "multiple failed" });
  });
});

describe(throwSettledFailures, () => {
  test("throws AggregateError with every failure", () => {
    const errors = [new Error("first"), new Error("second")];
    const results: PromiseSettledResult<unknown>[] = [
      { reason: errors[0], status: "rejected" },
      { reason: errors[1], status: "rejected" },
    ];

    expect(() => throwSettledFailures({ message: "both failed", results })).toThrow(AggregateError);
  });
});
