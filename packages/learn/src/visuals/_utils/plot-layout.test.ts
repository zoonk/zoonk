import { type PlotVisual } from "@zoonk/core/library/steps/contract";
import { describe, expect, it } from "vitest";
import { getLabelWidth } from "./category-labels";
import { HEIGHT, LABEL_GAP, PADDING } from "./chart-layout";
import { type PlotLayout, drawsDot, getPlotLayout } from "./plot-layout";
import { type PointLabel } from "./point-labels";

/** How wide the plot draws inside its card on a 390 px phone. */
const PHONE = 324;

const scan: PlotVisual = {
  kind: "plot",
  references: [],
  series: [
    {
      mark: "points",
      name: "Scan",
      points: [
        { label: "A", x: 0.5, y: 810 },
        { label: "B", x: 1.5, y: 880 },
        { label: "C", x: 3, y: 985 },
        { label: "D", x: 4.5, y: 890 },
        { label: "E", x: 5.5, y: 820 },
      ],
    },
  ],
  source: null,
  title: "Detector scan",
  xLabel: "Detector position",
  xUnit: "mm",
  yLabel: "Count rate",
  yUnit: "counts/s",
};

const control: PlotVisual = {
  kind: "plot",
  references: [
    { label: "Upper limit", y: 503 },
    { label: "Target", y: 500 },
    { label: "Lower limit", y: 497 },
  ],
  series: [
    {
      mark: "lineWithPoints",
      name: "Fill weight",
      points: [499.8, 500.6, 499.3, 501, 500.4, 501.6, 502.3, 503.8, 502.9, 502.1].map(
        (y, index) => ({ label: null, x: index + 1, y }),
      ),
    },
  ],
  source: null,
  title: "Bottle fill weight, last 10 days",
  xLabel: "Day",
  xUnit: null,
  yLabel: "Fill weight",
  yUnit: "ml",
};

function layoutFor(visual: PlotVisual, width = PHONE): PlotLayout {
  return getPlotLayout({ formatX: String, formatY: String, visual, width });
}

function labelBox(label: PointLabel) {
  const width = getLabelWidth(label.text) - LABEL_GAP;
  const left = { end: label.x - width, middle: label.x - width / 2, start: label.x }[label.anchor];
  return { bottom: label.y + 7, left, right: left + width, top: label.y - 7 };
}

function touches(a: ReturnType<typeof labelBox>, b: ReturnType<typeof labelBox>) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

describe(getPlotLayout, () => {
  it("spaces points by their x value, so unequal intervals get unequal gaps", () => {
    const layout = layoutFor({
      ...scan,
      series: [
        {
          mark: "line",
          name: "Position",
          points: [0, 1, 10].map((x) => ({ label: null, x, y: x })),
        },
      ],
    });

    const [first, second, third] = layout.series[0] ?? [];

    expect((third?.x ?? 0) - (second?.x ?? 0)).toBeCloseTo(
      ((second?.x ?? 0) - (first?.x ?? 0)) * 9,
    );
  });

  it("keeps repeated x values as separate points", () => {
    const layout = layoutFor({
      ...scan,
      series: [
        {
          mark: "points",
          name: "Students",
          points: [
            { label: null, x: 2, y: 60 },
            { label: null, x: 2, y: 75 },
          ],
        },
      ],
    });

    expect(layout.series[0]).toHaveLength(2);
    expect(layout.series[0]?.[0]?.x).toBe(layout.series[0]?.[1]?.x);
  });

  it("puts each name beside its dot, inside the plot, covering no other dot or name", () => {
    const layout = layoutFor(scan);
    const dots = layout.series[0] ?? [];

    expect(layout.key).toStrictEqual([]);
    expect(layout.labels.map((label) => label.text)).toStrictEqual(["A", "B", "C", "D", "E"]);

    layout.labels.forEach((label, index) => {
      const box = labelBox(label);
      const dot = dots[index];

      expect(Math.hypot((dot?.x ?? 0) - label.x, (dot?.y ?? 0) - label.y)).toBeLessThan(20);
      expect(box.left).toBeGreaterThanOrEqual(layout.left);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeLessThanOrEqual(layout.plotBottom);

      layout.labels.forEach((other, otherIndex) => {
        expect(otherIndex === index || !touches(box, labelBox(other))).toBe(true);
      });

      dots.forEach((other) => {
        const dotBox = {
          bottom: other.y + 4,
          left: other.x - 4,
          right: other.x + 4,
          top: other.y - 4,
        };

        expect(touches(box, dotBox)).toBe(false);
      });
    });
  });

  it("moves long names into a numbered key when they would crowd, dropping none", () => {
    const names = ["North", "South", "East", "West", "Center", "Harbor", "Airport", "Hills"].map(
      (place) => `${place} warehouse`,
    );

    const crowded: PlotVisual = {
      ...scan,
      series: [
        {
          mark: "points",
          name: "Sites",
          points: [
            ...names.map((label, index) => ({ label, x: 5 + index * 0.1, y: 150 + index })),
            { label: null, x: 0, y: 100 },
            { label: null, x: 10, y: 200 },
          ],
        },
      ],
    };

    const layout = layoutFor(crowded);

    expect(layout.key.map((entry) => entry.label)).toStrictEqual(names);

    expect(layout.labels.map((label) => label.text)).toStrictEqual(
      names.map((_, index) => String(index + 1)),
    );
  });

  it("names reference lines past the plot's right edge, without overlapping each other", () => {
    const layout = layoutFor(control);
    const [upper, target, lower] = layout.references;

    expect(layout.references.map((reference) => reference.label)).toStrictEqual([
      "Upper limit",
      "Target",
      "Lower limit",
    ]);

    expect(layout.plotRight + LABEL_GAP + getLabelWidth("Upper limit")).toBeLessThanOrEqual(
      PHONE + LABEL_GAP,
    );

    expect(layout.y.toPixel(503)).toBe(upper?.y);
    expect((target?.top ?? 0) - (upper?.top ?? 0)).toBeGreaterThanOrEqual(14);
    expect((lower?.top ?? 0) - (target?.top ?? 0)).toBeGreaterThanOrEqual(14);
  });

  it("stacks names of lines too close to read apart and keeps them inside the chart", () => {
    const layout = layoutFor({
      ...control,
      references: [
        { label: "Alarm", y: 497.1 },
        { label: "Lower limit", y: 497 },
      ],
    });

    const [first, second] = layout.references;

    expect((second?.top ?? 0) - (first?.top ?? 0)).toBeGreaterThanOrEqual(14);
    expect((second?.top ?? 0) + 14).toBeLessThanOrEqual(HEIGHT);
  });

  it("fits the y axis to the data and references, with no forced zero", () => {
    const layout = layoutFor(control);

    expect(layout.y.domain[0]).toBeGreaterThan(490);
    expect(layout.y.domain[1]).toBeGreaterThanOrEqual(503.8);
    expect(layout.y.domain[0]).toBeLessThanOrEqual(497);
  });

  it("thins x tick labels that would touch on a narrow phone", () => {
    const wide = layoutFor(control);

    const narrow = getPlotLayout({
      formatX: (value) => `Day ${String(value)} of the run`,
      formatY: String,
      visual: control,
      width: 254,
    });

    expect(wide.xTicks.length).toBeGreaterThan(narrow.xTicks.length);
  });

  it("uses the full width when there are no references", () => {
    expect(layoutFor(scan).plotRight).toBe(PHONE - PADDING.right);
  });
});

describe(drawsDot, () => {
  it("draws every point of a dotted series and only a line's last point beside other series", () => {
    expect(drawsDot({ index: 0, mark: "points", pointCount: 3, seriesCount: 1 })).toBe(true);

    expect(drawsDot({ index: 0, mark: "lineWithPoints", pointCount: 3, seriesCount: 1 })).toBe(
      true,
    );

    expect(drawsDot({ index: 2, mark: "line", pointCount: 3, seriesCount: 1 })).toBe(false);
    expect(drawsDot({ index: 2, mark: "line", pointCount: 3, seriesCount: 2 })).toBe(true);
    expect(drawsDot({ index: 1, mark: "line", pointCount: 3, seriesCount: 2 })).toBe(false);
  });
});
