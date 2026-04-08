import { describe, expect, test } from "vitest";
import { rejected, settled, settledValues } from "./settled";

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

describe(rejected, () => {
  test("returns true when any result is rejected", () => {
    const results: PromiseSettledResult<string>[] = [
      { status: "fulfilled", value: "ok" },
      { reason: new Error("fail"), status: "rejected" },
    ];

    expect(rejected(results)).toBe(true);
  });

  test("returns true when a fulfilled value has a truthy error property", () => {
    const results: PromiseSettledResult<{ data: null; error: Error }>[] = [
      { status: "fulfilled", value: { data: null, error: new Error("fail") } },
    ];

    expect(rejected(results)).toBe(true);
  });

  test("returns false when a fulfilled value has a falsy error property", () => {
    const results: PromiseSettledResult<{ data: string; error: null }>[] = [
      { status: "fulfilled", value: { data: "ok", error: null } },
    ];

    expect(rejected(results)).toBe(false);
  });

  test("returns false when all results are fulfilled without errors", () => {
    const results: PromiseSettledResult<string>[] = [
      { status: "fulfilled", value: "a" },
      { status: "fulfilled", value: "b" },
    ];

    expect(rejected(results)).toBe(false);
  });

  test("returns false for an empty array", () => {
    expect(rejected([])).toBe(false);
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
