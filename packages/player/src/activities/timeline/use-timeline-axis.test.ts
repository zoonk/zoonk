import { describe, expect, it } from "vitest";
import { spreadLabels } from "./timeline-scale";
import { yearToY } from "./use-timeline-axis";

describe(yearToY, () => {
  it("ends the axis where a card can sit level with its dot", () => {
    const gap = 54;
    const axis = { end: 2000, height: 320, inset: gap / 2, start: -3000 };
    const dots = [yearToY(axis.start, axis), yearToY(axis.end, axis)];

    expect(
      spreadLabels({ bottom: axis.height - axis.inset, gap, positions: dots, top: axis.inset }),
    ).toStrictEqual(dots);
  });
});
