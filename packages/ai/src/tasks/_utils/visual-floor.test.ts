import { describe, expect, it } from "vitest";
import { getVisualFloor } from "./visual-floor";

describe(getVisualFloor, () => {
  it("lets a lesson's audience decide its floor, so class material gets one learner's", () => {
    expect(getVisualFloor({})).toBe("pictures");
    expect(getVisualFloor({ isPrivate: true })).toBe("drawn");
    expect(getVisualFloor({ material: "<page>Slides</page>" })).toBe("drawn");
  });
});
