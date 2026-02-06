import { describe, expect, it } from "vitest";
import { PHASE_ICONS, PHASE_ORDER } from "./generation-phases";

describe("generation-phases", () => {
  it("PHASE_ORDER contains all 7 phase names", () => {
    expect(PHASE_ORDER).toEqual([
      "preparingLessons",
      "figuringOutApproach",
      "settingUpActivities",
      "writingContent",
      "preparingVisuals",
      "creatingImages",
      "finishing",
    ]);
  });

  it("every phase in PHASE_ORDER has an icon in PHASE_ICONS", () => {
    for (const phase of PHASE_ORDER) {
      expect(PHASE_ICONS[phase]).toBeDefined();
    }
  });
});
