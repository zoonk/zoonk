import { describe, expect, test } from "vitest";
import {
  getSettledFailureError,
  settled,
  settledFailures,
  settledValues,
  throwSettledFailures,
} from "./settled";

describe(settled, () => {
  test("returns fulfilled value", () => {
    const result: PromiseSettledResult<string> = {
      status: "fulfilled",
      value: "hello",
    };

    expect(settled(result, "fallback")).toBe("hello");
  });

  test("returns fallback for rejected", () => {
    const result: PromiseSettledResult<string> = {
      reason: new Error("fail"),
      status: "rejected",
    };

    expect(settled(result, "fallback")).toBe("fallback");
  });
});

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

describe(settledValues, () => {
  test("extracts fulfilled values and drops rejections", () => {
    const results: PromiseSettledResult<number>[] = [
      { status: "fulfilled", value: 1 },
      { reason: new Error("fail"), status: "rejected" },
      { status: "fulfilled", value: 3 },
    ];

    expect(settledValues(results)).toEqual([1, 3]);
  });

  test("returns all values when none are rejected", () => {
    const results: PromiseSettledResult<string>[] = [
      { status: "fulfilled", value: "a" },
      { status: "fulfilled", value: "b" },
    ];

    expect(settledValues(results)).toEqual(["a", "b"]);
  });

  test("returns an empty array when all are rejected", () => {
    const results: PromiseSettledResult<string>[] = [
      { reason: new Error("a"), status: "rejected" },
      { reason: new Error("b"), status: "rejected" },
    ];

    expect(settledValues(results)).toEqual([]);
  });

  test("returns an empty array for empty input", () => {
    expect(settledValues([])).toEqual([]);
  });
});
