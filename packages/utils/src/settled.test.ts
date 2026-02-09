import { describe, expect, test } from "vitest";
import { settled } from "./settled";

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
