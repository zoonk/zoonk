import { describe, expect, it } from "vitest";
import { edgeAnchor } from "./drawing-label";

const axis = [44, 836] as const;

describe(edgeAnchor, () => {
  it("centers a label on a tick inside its axis", () => {
    expect(edgeAnchor({ at: 440, range: axis, width: 28 })).toBe("middle");
  });

  it("ends the last tick's label at its tick so it stays over the axis", () => {
    expect(edgeAnchor({ at: 836, range: axis, width: 28 })).toBe("end");
    expect(edgeAnchor({ at: 826, range: axis, width: 28 })).toBe("end");
  });

  it("starts the first tick's label at its tick so it doesn't hang left of the axis", () => {
    expect(edgeAnchor({ at: 44, range: axis, width: 28 })).toBe("start");
    expect(edgeAnchor({ at: 52, range: axis, width: 28 })).toBe("start");
  });
});
