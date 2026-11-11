import { type ChartVisual } from "@zoonk/core/library/steps/contract";
import { assert, integer, property, stringMatching, uniqueArray } from "fast-check";
import { describe, expect, it } from "vitest";
import { getLabelWidth } from "./category-labels";
import { type ColumnLayout, PADDING, type RowLayout, fitsLabel, getLayout } from "./chart-layout";

const visual: ChartVisual = {
  axisStart: null,
  categories: ["May", "Jun", "Jul"],
  categoryLabel: "Month",
  chart: "bar",
  kind: "chart",
  series: [{ name: "Letters", values: [35, 36, 40] }],
  source: null,
  title: "Letters answered",
  unit: null,
  valueLabel: "Letters",
};

const REGIONS = ["Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste"];

/** How wide the chart draws inside its card on a 320 and a 390 px phone. */
const NARROW = 254;
const WIDE = 324;

function layoutFor(chart: ChartVisual, width: number) {
  return getLayout({ formatTick: String, formatValue: String, visual: chart, width });
}

function columns(layout: ColumnLayout | RowLayout): ColumnLayout {
  if (layout.orientation !== "vertical") {
    throw new Error("Expected upright bars.");
  }

  return layout;
}

function rows(layout: ColumnLayout | RowLayout): RowLayout {
  if (layout.orientation !== "horizontal") {
    throw new Error("Expected sideways bars.");
  }

  return layout;
}

function valueLabelEdges({ layout, value }: { layout: RowLayout; value: number }) {
  const end = layout.x.toPixel(value);
  const room = getLabelWidth(String(value));

  return value < layout.origin
    ? { left: end - room, right: end }
    : { left: end, right: end + room };
}

describe(getLayout, () => {
  it("keeps the axis width for short tick labels", () => {
    expect(columns(layoutFor(visual, 320)).left).toBe(PADDING.left);
  });

  it("widens the axis so a long tick label isn't cut off", () => {
    const layout = columns(
      getLayout({
        formatTick: (tick) => `${tick} hours/day`,
        formatValue: String,
        visual,
        width: 320,
      }),
    );

    expect(layout.left).toBeGreaterThan(PADDING.left);
    expect(layout.yTicks.every((tick) => getLabelWidth(tick.label) <= layout.left)).toBe(true);
  });

  it("keeps short names under upright bars on a narrow phone", () => {
    const weekdays = { ...visual, categories: ["Seg", "Ter", "Qua", "Qui", "Sex"] };

    const layout = columns(
      layoutFor({ ...weekdays, series: [{ name: "A", values: [1, 2, 3, 4, 5] }] }, NARROW),
    );

    expect(layout.labels.step).toBe(1);
  });

  it("lays bars on their side, one full name per row, when a name doesn't fit under its bar", () => {
    const regions = {
      ...visual,
      categories: REGIONS,
      series: [{ name: "A", values: [18, 42, 64, 30, 22] }],
    };

    for (const width of [NARROW, WIDE]) {
      const layout = rows(layoutFor(regions, width));
      expect(layout.rows.map((row) => row.lines.join(" "))).toStrictEqual(REGIONS);
    }
  });

  it("gives each series its own bar under the name and grows taller with each row", () => {
    const twoSeries = {
      ...visual,
      categories: REGIONS,
      series: [
        { name: "2010", values: [18, 42, 64, 30, 22] },
        { name: "2020", values: [20, 45, 70, 31, 25] },
      ],
    };

    const layout = rows(layoutFor(twoSeries, NARROW));

    const fewer = rows(
      layoutFor(
        {
          ...twoSeries,
          categories: REGIONS.slice(0, 4),
          series: twoSeries.series.map((series) => ({
            ...series,
            values: series.values.slice(0, 4),
          })),
        },
        NARROW,
      ),
    );

    expect(layout.rows.every((row) => row.barTops.length === 2)).toBe(true);

    expect(
      layout.rows.every(
        (row, index) => index === 0 || row.nameTop > (layout.rows[index - 1]?.bottom ?? 0),
      ),
    ).toBe(true);

    expect(layout.height).toBeGreaterThan(fewer.height);
    expect(layout.height).toBeGreaterThan(layout.gridBottom);
  });

  it("runs a negative bar left of zero, with its value on the left inside the chart", () => {
    const change = {
      ...visual,
      categories: REGIONS,
      series: [{ name: "A", values: [-12, 40, 25, -3, 8] }],
    };

    const layout = rows(layoutFor(change, NARROW));

    expect(layout.showValues).toBe(true);
    expect(layout.x.toPixel(-12)).toBeLessThan(layout.x.toPixel(layout.origin));

    for (const value of change.series[0]?.values ?? []) {
      const edges = valueLabelEdges({ layout, value });
      expect(edges.left).toBeGreaterThanOrEqual(0);
      expect(edges.right).toBeLessThanOrEqual(NARROW);
    }
  });

  it("starts sideways bars where a cropped axis starts", () => {
    const cropped = {
      ...visual,
      axisStart: 30,
      categories: REGIONS,
      series: [{ name: "A", values: [35, 36, 40, 38, 33] }],
    };

    const layout = rows(layoutFor(cropped, NARROW));

    expect(layout.origin).toBe(30);
    expect(layout.x.domain[0]).toBe(30);
    expect(layout.xTicks.map((tick) => tick.value)).toContain(30);
  });

  it("leaves values off sideways bars when they'd take more than a third of the width", () => {
    const layout = rows(
      getLayout({
        formatTick: String,
        formatValue: (value) => `${value} letters answered`,
        visual: {
          ...visual,
          categories: REGIONS,
          series: [{ name: "A", values: [18, 42, 64, 30, 22] }],
        },
        width: NARROW,
      }),
    );

    expect(layout.showValues).toBe(false);
    expect(layout.x.range).toStrictEqual([0, NARROW]);
  });

  it("keeps every other tick under sideways bars when their labels would overlap", () => {
    const layout = rows(
      getLayout({
        formatTick: (tick) => `${tick} km/h`,
        formatValue: String,
        visual: {
          ...visual,
          categories: REGIONS,
          series: [{ name: "A", values: [180, 420, 640, 300, 220] }],
        },
        width: NARROW,
      }),
    );

    const centers = layout.xTicks.map((tick) => layout.x.toPixel(tick.value));
    const widest = Math.max(...layout.xTicks.map((tick) => getLabelWidth(tick.label)));

    expect(centers.length).toBeGreaterThan(1);

    expect(
      centers.every((center, index) => index === 0 || center - (centers[index - 1] ?? 0) >= widest),
    ).toBe(true);
  });

  it("keeps a line chart's ordered axis upright, naming every few points", () => {
    const line = {
      ...visual,
      categories: ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira"],
      chart: "line" as const,
    };

    expect(columns(layoutFor(line, NARROW)).labels.step).toBeGreaterThan(1);
  });

  it("names every bar in full and keeps values inside the chart, whatever the names and width", () => {
    const name = stringMatching(/^[A-Za-zÀ-ú]{1,12}(?:[ -][A-Za-zÀ-ú]{1,12}){0,3}$/u);

    assert(
      property(
        uniqueArray(name, { maxLength: 12, minLength: 2 }),
        integer({ max: 900, min: 200 }),
        integer({ max: 3, min: 1 }),
        (categories, width, seriesCount) => {
          const series = Array.from({ length: seriesCount }, (_, seriesIndex) => ({
            name: `S${seriesIndex}`,
            values: categories.map((_category, index) => (index + seriesIndex) * 7 - 10),
          }));

          const layout = layoutFor({ ...visual, categories, series }, width);

          if (layout.orientation === "vertical") {
            return (
              layout.labels.step === 1 && layout.labels.lines.every((lines) => lines.length <= 2)
            );
          }

          const namesInFull = layout.rows.every(
            (row, index) =>
              row.lines.join("").replaceAll(" ", "") === categories[index]?.replaceAll(" ", ""),
          );

          const valuesInside =
            !layout.showValues ||
            series
              .flatMap((item) => item.values)
              .map((value) => valueLabelEdges({ layout, value }))
              .every((edge) => edge.left >= 0 && edge.right <= width);

          return namesInFull && valuesInside;
        },
      ),
    );
  });
});

describe(fitsLabel, () => {
  it("fits a label only when it's no wider than its room", () => {
    expect(fitsLabel("40", 30)).toBe(true);
    expect(fitsLabel("40 hours/day", 30)).toBe(false);
  });
});
