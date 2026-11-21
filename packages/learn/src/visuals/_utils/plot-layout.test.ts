import { type PlotVisual } from "@zoonk/core/library/steps/contract";
import { describe, expect, it } from "vitest";
import { getLabelWidth } from "./category-labels";
import { LABEL_GAP, PADDING } from "./chart-layout";
import { type PlotLayout, drawsDot, getPlotLayout, getPlotTextScale } from "./plot-layout";
import { MIN_PLOT_WIDTH } from "./plot-references";
import { DOT_RADIUS, type PointLabel } from "./point-labels";

const PHONE = 324;
const SMALL_PHONE_CARD = 296;
const LARGEST_TEXT = 2;
const DESKTOP_CARD = 640;

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

const fineScan: PlotVisual = {
  ...scan,
  references: [{ label: "Needed tonight", y: 960 }],
  series: [
    {
      mark: "lineWithPoints",
      name: "Fine scan",
      points: [
        [1.5, 880],
        [2, 930],
        [2.25, 968],
        [2.5, 992],
        [2.75, 975],
        [3, 952],
        [3.25, 925],
        [3.5, 905],
        [4, 893],
        [4.5, 890],
      ].map(([x = 0, y = 0]) => ({ label: null, x, y })),
    },
  ],
  title: "Finer scan, B to D",
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
  return getPlotLayout({ locale: "en", visual, width });
}

function plotWidth(layout: PlotLayout): number {
  return layout.plotRight - layout.left;
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
  it("keeps a percent on each tick, the way a category chart does", () => {
    const percent = layoutFor({ ...control, references: [], yLabel: "Yield", yUnit: "%" });
    const labels = percent.yTicks.map((tick) => tick.label);
    const millilitres = layoutFor({ ...control, references: [] }).yTicks.map((tick) => tick.label);

    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((label) => label.endsWith("%"))).toBe(true);
    expect(millilitres.some((label) => label.includes("ml"))).toBe(false);
  });

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

  it("puts a single point in the middle of the plot, not in the axes' corner", () => {
    const layout = layoutFor({
      ...scan,
      series: [{ mark: "points", name: "Scan", points: [{ label: "Peak", x: 3, y: 952 }] }],
    });

    const [dot] = layout.series[0] ?? [];

    expect(dot?.x).toBeCloseTo((layout.left + layout.plotRight) / 2);
    expect(dot?.y).toBeCloseTo((layout.y.range[0] + layout.y.range[1]) / 2);
  });

  it("spans the x axis from the first day to the last, not from zero", () => {
    const layout = layoutFor(control);

    expect(layout.x.domain).toStrictEqual([1, 10]);
    expect(layout.series[0]?.[0]?.x).toBe(layout.left);
    expect(layout.xTicks.map((tick) => tick.label)).toStrictEqual(["2", "4", "6", "8", "10"]);
  });

  it("centers every x number under its value and leaves out one that would reach the corner", () => {
    const layout = layoutFor({
      ...control,
      series: [
        {
          mark: "line",
          name: "Fill weight",
          points: [1000, 1500, 2000].map((x) => ({ label: null, x, y: 500 })),
        },
      ],
    });

    for (const tick of layout.xTicks) {
      expect(tick.center).toBe(layout.x.toPixel(tick.value));
    }

    expect(layout.xTicks.map((tick) => tick.value)).toStrictEqual([1200, 1400, 1600, 1800, 2000]);
  });

  it("prints ticks that differ as different numbers", () => {
    const layout = layoutFor({
      ...scan,
      series: [
        {
          mark: "points",
          name: "Visitors",
          points: [10_000, 10_150, 10_400].map((value) => ({ label: null, x: value, y: value })),
        },
      ],
    });

    expect(new Set(layout.yTicks.map((tick) => tick.label)).size).toBe(layout.yTicks.length);
    expect(new Set(layout.xTicks.map((tick) => tick.label)).size).toBe(layout.xTicks.length);
  });

  it("draws no gridline under a reference line, so its dashes stay visible", () => {
    const layout = layoutFor(control);
    const target = layout.yTicks.find((tick) => tick.value === 500);

    expect(target).toMatchObject({ label: "500", line: false });
    expect(layout.yTicks.filter((tick) => tick.line)).toHaveLength(layout.yTicks.length - 1);
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

  it("makes the names' column as wide as its widest wrapped line", () => {
    const width = 300;
    const layout = layoutFor(fineScan, width);

    expect(layout.references[0]?.lines).toStrictEqual(["Needed", "tonight"]);
    expect(layout.plotRight).toBeCloseTo(width - DOT_RADIUS - LABEL_GAP - getLabelWidth("tonight"));
  });

  it("numbers lines too close to name apart, each number level with its own line", () => {
    const layout = layoutFor({
      ...control,
      references: [
        { label: "Upper limit", y: 501 },
        { label: "Upper warning limit", y: 500.6 },
        { label: "Target", y: 500 },
      ],
    });

    expect(layout.key).toStrictEqual([
      { label: "Upper limit", marker: "1" },
      { label: "Upper warning limit", marker: "2" },
      { label: "Target", marker: "3" },
    ]);

    for (const reference of layout.references) {
      expect(reference.top + 7).toBeCloseTo(reference.y);
    }

    const [upper, warning, target] = layout.references;

    expect(warning?.x).toBeGreaterThan(upper?.x ?? 0);
    expect(warning?.x).toBeGreaterThan(target?.x ?? 0);
  });

  it("numbers lines whose names can't fit beside a plot of the narrowest width", () => {
    const width = 220;

    const layout = layoutFor(
      { ...control, references: [{ label: "Temperaturgrenze", y: 502 }] },
      width,
    );

    expect(layout.key).toStrictEqual([{ label: "Temperaturgrenze", marker: "1" }]);
    expect(layout.references[0]?.lines).toStrictEqual(["1"]);
    expect(plotWidth(layout)).toBeGreaterThanOrEqual(MIN_PLOT_WIDTH);
  });

  it("continues the key's numbers from the lines to the points", () => {
    const layout = layoutFor(
      {
        ...scan,
        references: [{ label: "Temperaturgrenze", y: 900 }],
        series: [
          {
            mark: "points",
            name: "Sites",
            points: ["North", "South", "East"].map((place, index) => ({
              label: `${place} warehouse`,
              x: 5 + index * 0.05,
              y: 850 + index,
            })),
          },
        ],
      },
      200,
    );

    expect(layout.key.map((entry) => entry.marker)).toStrictEqual(["1", "2", "3", "4"]);
    expect(layout.labels.map((label) => label.text)).toStrictEqual(["2", "3", "4"]);
  });

  it.each([PHONE, 200])(
    "keeps a point on the plot's right edge clear of the reference names (%d px)",
    (width) => {
      const layout = layoutFor(control, width);
      const last = layout.series[0]?.at(-1);

      expect(last?.x).toBe(layout.plotRight);

      for (const reference of layout.references) {
        expect(reference.x - layout.plotRight).toBeGreaterThan(DOT_RADIUS + LABEL_GAP / 2);
      }
    },
  );

  it("fits the y axis to the data and references, with no forced zero", () => {
    const layout = layoutFor(control);

    expect(layout.y.domain[0]).toBeGreaterThan(490);
    expect(layout.y.domain[1]).toBeGreaterThanOrEqual(503.8);
    expect(layout.y.domain[0]).toBeLessThanOrEqual(497);
  });

  it("thins x tick labels that would touch on a narrow phone", () => {
    const wide = layoutFor(control);

    const narrow = getPlotLayout({
      locale: "en",
      textWidth: (text) => text.length * 20,
      visual: control,
      width: 254,
    });

    expect(wide.xTicks.length).toBeGreaterThan(narrow.xTicks.length);
  });

  it("uses the full width when there are no references", () => {
    expect(layoutFor(scan).plotRight).toBe(PHONE - PADDING.right);
  });
});

describe(getPlotTextScale, () => {
  it("stops growing the drawing's text where the plot would get narrower than its floor", () => {
    const scale = getPlotTextScale({
      boxWidth: SMALL_PHONE_CARD,
      locale: "en",
      textScale: LARGEST_TEXT,
      visual: fineScan,
    });

    const layout = layoutFor(fineScan, SMALL_PHONE_CARD / scale);

    expect(scale).toBeGreaterThan(1);
    expect(scale).toBeLessThan(LARGEST_TEXT);
    expect(plotWidth(layout)).toBeGreaterThanOrEqual(MIN_PLOT_WIDTH - 0.01);
    expect(layout.key).toStrictEqual([]);
    expect(layout.references[0]?.lines).toStrictEqual(["Needed", "tonight"]);
  });

  it("follows the text size wherever the plot keeps its room", () => {
    expect(
      getPlotTextScale({
        boxWidth: DESKTOP_CARD,
        locale: "en",
        textScale: LARGEST_TEXT,
        visual: fineScan,
      }),
    ).toBe(LARGEST_TEXT);
  });

  it("never shrinks the drawing's text below the reader's size", () => {
    expect(getPlotTextScale({ boxWidth: 100, locale: "en", textScale: 1, visual: fineScan })).toBe(
      1,
    );
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
