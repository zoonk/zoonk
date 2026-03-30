import { describe, expect, it } from "vitest";
import { getConsequenceTier } from "./get-consequence-tier";

describe(getConsequenceTier, () => {
  it("returns 'neglected' for 0 tokens", () => {
    expect(getConsequenceTier(0)).toBe("neglected");
  });

  it("returns 'maintained' for 1 token", () => {
    expect(getConsequenceTier(1)).toBe("maintained");
  });

  it("returns 'invested' for 2 tokens", () => {
    expect(getConsequenceTier(2)).toBe("invested");
  });

  it("returns 'invested' for 3+ tokens", () => {
    expect(getConsequenceTier(3)).toBe("invested");
    expect(getConsequenceTier(5)).toBe("invested");
  });
});
