import { describe, expect, it } from "vitest";
import { getSettledFailureError, settledFailures, throwSettledFailures } from "./settled";

describe(settledFailures, () => {
  it("returns every rejected reason and fulfilled error", () => {
    const rejectedError = new Error("rejected");
    const fulfilledError = new Error("fulfilled error");
    const results: PromiseSettledResult<unknown>[] = [
      { status: "fulfilled", value: "ok" },
      { reason: rejectedError, status: "rejected" },
      { status: "fulfilled", value: { data: null, error: fulfilledError } },
    ];

    expect(settledFailures(results)).toEqual([rejectedError, fulfilledError]);
  });

  it("returns an empty array when nothing failed", () => {
    const results: PromiseSettledResult<unknown>[] = [
      { status: "fulfilled", value: "ok" },
      { status: "fulfilled", value: { data: "ok", error: null } },
    ];

    expect(settledFailures(results)).toEqual([]);
  });
});

describe(getSettledFailureError, () => {
  it("returns null when there are no failures", () => {
    expect(getSettledFailureError({ failures: [], message: "failed" })).toBeNull();
  });

  it("returns the original error when exactly one operation failed", () => {
    const error = new Error("single");

    expect(getSettledFailureError({ failures: [error], message: "failed" })).toBe(error);
  });

  it("returns AggregateError when multiple operations failed", () => {
    const errors = [new Error("first"), new Error("second")];
    const error = getSettledFailureError({ failures: errors, message: "multiple failed" });

    expect(error).toBeInstanceOf(AggregateError);
    expect(error).toMatchObject({ errors, message: "multiple failed" });
  });
});

describe(throwSettledFailures, () => {
  it("throws AggregateError with every failure", () => {
    const errors = [new Error("first"), new Error("second")];
    const results: PromiseSettledResult<unknown>[] = [
      { reason: errors[0], status: "rejected" },
      { reason: errors[1], status: "rejected" },
    ];

    expect(() => throwSettledFailures({ message: "both failed", results })).toThrow(AggregateError);
  });
});
