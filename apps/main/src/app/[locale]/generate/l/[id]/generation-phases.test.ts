import { describe, expect, it } from "vitest";
import { PHASE_ICONS, PHASE_ORDER } from "./generation-phases";

describe("PHASE_ORDER", () => {
  it("contains all 4 phase names", () => {
    expect(PHASE_ORDER).toEqual([
      "gettingStarted",
      "figuringOutApproach",
      "settingUpActivities",
      "finishing",
    ]);
  });
});

describe("PHASE_ICONS", () => {
  it("has an icon for every phase in PHASE_ORDER", () => {
    for (const phase of PHASE_ORDER) {
      expect(PHASE_ICONS[phase]).toBeDefined();
    }
  });
});
