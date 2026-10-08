import { describe, expect, it } from "vitest";
import { decideBoolean } from "./decisions";

describe(decideBoolean, () => {
  it("returns true at or above the threshold and false below it", () => {
    expect(decideBoolean({ probability: 0.5, threshold: 0.5 })).toBe(true);
    expect(decideBoolean({ probability: 0.97, threshold: 0.8 })).toBe(true);
    expect(decideBoolean({ probability: 0.49, threshold: 0.5 })).toBe(false);
  });

  it("rejects values outside the probability range", () => {
    expect(() => decideBoolean({ probability: 1.2, threshold: 0.8 })).toThrow(
      "probability must be a probability",
    );

    expect(() => decideBoolean({ probability: 0.5, threshold: -0.1 })).toThrow(
      "threshold must be a probability",
    );
  });
});
