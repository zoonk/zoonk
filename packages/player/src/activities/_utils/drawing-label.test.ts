import { describe, expect, it } from "vitest";
import { edgeAnchor, sideOffLine } from "./drawing-label";

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

describe(sideOffLine, () => {
  const size = { height: 12, width: 36 };

  it("puts a label above its mark when the line runs below it", () => {
    const line = [
      { x: 0, y: 140 },
      { x: 400, y: 120 },
    ];

    expect(sideOffLine({ gap: 15, line, mark: { x: 200, y: 100 }, size })).toBe("above");
  });

  it("puts it under the mark when the line runs through the spot above it", () => {
    const line = [
      { x: 0, y: 120 },
      { x: 200, y: 82 },
      { x: 400, y: 80 },
    ];

    expect(sideOffLine({ gap: 15, line, mark: { x: 260, y: 100 }, size })).toBe("below");
  });

  it("keeps it above when the line runs under the mark and through the spot below", () => {
    const line = [
      { x: 0, y: 130 },
      { x: 400, y: 110 },
    ];

    expect(sideOffLine({ gap: 15, line, mark: { x: 200, y: 100 }, size })).toBe("above");
  });
});
