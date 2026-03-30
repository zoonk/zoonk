import { describe, expect, it } from "vitest";
import { getEffectiveTokenTotal, getStateDirection, getStateTier } from "./state-tier";

describe(getStateTier, () => {
  it("returns Critical for negative states", () => {
    expect(getStateTier(-1)).toMatchObject({
      colorClass: "text-destructive",
      dotClass: "bg-destructive",
      label: "Critical",
    });
    expect(getStateTier(-2)).toMatchObject({ label: "Critical" });
  });

  it("returns Stressed for state 0", () => {
    expect(getStateTier(0)).toMatchObject({
      colorClass: "text-warning",
      dotClass: "bg-warning",
      label: "Stressed",
    });
  });

  it("returns Stable for state 1", () => {
    expect(getStateTier(1)).toMatchObject({
      colorClass: "text-muted-foreground",
      dotClass: "bg-muted-foreground",
      label: "Stable",
    });
  });

  it("returns Healthy for state 2", () => {
    const tier = getStateTier(2);
    expect(tier.label).toBe("Healthy");
    expect(tier.colorClass).toContain("text-sky");
    expect(tier.dotClass).toContain("bg-sky");
  });

  it("returns Thriving for state 3+", () => {
    expect(getStateTier(3)).toMatchObject({
      colorClass: "text-success",
      dotClass: "bg-success",
      label: "Thriving",
    });
    expect(getStateTier(5)).toMatchObject({ label: "Thriving" });
  });
});

describe(getStateDirection, () => {
  it("returns ↑ for positive delta", () => {
    expect(getStateDirection(1)).toBe("↑");
    expect(getStateDirection(2)).toBe("↑");
  });

  it("returns ↓ for negative delta", () => {
    expect(getStateDirection(-1)).toBe("↓");
    expect(getStateDirection(-2)).toBe("↓");
  });

  it("returns → for zero delta", () => {
    expect(getStateDirection(0)).toBe("→");
  });
});

describe(getEffectiveTokenTotal, () => {
  it("returns tokenOverride when set", () => {
    expect(getEffectiveTokenTotal({ resource: { total: 5 }, tokenOverride: 4 })).toBe(4);
  });

  it("returns resource.total when tokenOverride is null", () => {
    expect(getEffectiveTokenTotal({ resource: { total: 5 }, tokenOverride: null })).toBe(5);
  });
});
