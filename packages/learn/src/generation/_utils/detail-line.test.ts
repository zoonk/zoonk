import { describe, expect, it } from "vitest";
import { getDetailLine } from "./detail-line";

const numbered = { count: 3, line: (number: number) => `Screen ${number}`, review: "Review" };

describe(getDetailLine, () => {
  it("shows the phase's lines in order", () => {
    expect(getDetailLine({ lines: ["A", "B"], tick: 0 })).toBe("A");
    expect(getDetailLine({ lines: ["A", "B"], tick: 1 })).toBe("B");
  });

  it("counts what the phase makes after its lines, reviewing every two", () => {
    const shown = [2, 3, 4, 5, 6].map((tick) =>
      getDetailLine({ lines: ["A", "B"], numbered, tick }),
    );

    expect(shown).toStrictEqual(["Screen 1", "Screen 2", "Review", "Screen 3", "A"]);
  });

  it("never counts past what the phase makes", () => {
    const shown = Array.from({ length: 30 }, (_, tick) =>
      getDetailLine({ lines: ["A"], numbered, tick }),
    );

    expect(shown).not.toContain("Screen 4");
    expect(["A", "Review"]).toContain(shown.at(-1));
  });

  it("repeats a phase's lines while it keeps running", () => {
    expect(getDetailLine({ lines: ["A", "B"], tick: 5 })).toBe("B");
  });

  it("has nothing to say without lines", () => {
    expect(getDetailLine({ lines: [], tick: 3 })).toBeNull();
  });
});
