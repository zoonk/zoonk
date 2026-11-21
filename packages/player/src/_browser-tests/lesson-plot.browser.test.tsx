import { type PlotVisual } from "@zoonk/core/library/steps/contract";
import { DETECTOR_SCAN_PLOT, FILL_WEIGHT_PLOT } from "@zoonk/testing/fixtures/plot-visuals";
import { describe, expect, it, onTestFinished } from "vitest";
import { type Locator, page } from "vitest/browser";
import { expectAccessibleScreen } from "../_test-utils/accessibility";
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";

const NARROW_PHONE = { height: 640, width: 320 };

function check(visual: PlotVisual) {
  const base = teachingStep("check");
  return { ...base, content: { ...base.content, visual } };
}

function drawnTexts(chart: Locator) {
  return [...chart.element().querySelectorAll("svg text")].map((text) => ({
    box: text.getBoundingClientRect(),
    label: text.textContent,
  }));
}

/** Every pair of drawn words that cover each other, and any word past the card's edge. */
function crowdedTexts(chart: Locator): string[] {
  const card = chart.element().getBoundingClientRect();
  const texts = drawnTexts(chart);

  const outside = texts
    .filter(({ box }) => box.left < card.left || box.right > card.right)
    .map(({ label }) => `${label ?? ""} is outside the card`);

  const overlapping = texts.flatMap((a, index) =>
    texts
      .slice(index + 1)
      .filter(
        (b) =>
          a.box.left < b.box.right &&
          b.box.left < a.box.right &&
          a.box.top < b.box.bottom &&
          b.box.top < a.box.bottom,
      )
      .map((b) => `${a.label ?? ""} / ${b.label ?? ""}`),
  );

  return [...outside, ...overlapping];
}

describe("lesson plots", () => {
  it("names each point beside its dot and gives screen readers the axes and every point", async () => {
    await atViewport(NARROW_PHONE, async () => {
      renderLessonPlayer({ lesson: buildLesson([check(DETECTOR_SCAN_PLOT)]) });

      const chart = page.getByRole("figure", { name: DETECTOR_SCAN_PLOT.title });
      await expect.element(chart).toBeVisible();

      const labels = drawnTexts(chart).map(({ label }) => label);
      expect(labels).toStrictEqual(expect.arrayContaining(["A", "B", "C", "D", "E"]));
      await expect.poll(() => crowdedTexts(chart)).toStrictEqual([]);

      await expect
        .element(chart.getByText("Horizontal axis: Detector position, from 0 mm to 6 mm"))
        .toBeInTheDocument();

      await expect.element(chart.getByRole("rowheader", { name: "C" })).toBeInTheDocument();
      await expect.element(chart.getByRole("cell", { name: "952 counts/s" })).toBeInTheDocument();
      await expect.element(chart.getByRole("list")).not.toBeInTheDocument();
      await expect.element(chart.getByText(/Source/u)).not.toBeInTheDocument();

      await expectAccessibleScreen("a question with a scatter plot");
    });
  });

  it("names limit lines past the plot's right edge, clear of the data", async () => {
    await atViewport(NARROW_PHONE, async () => {
      renderLessonPlayer({ lesson: buildLesson([check(FILL_WEIGHT_PLOT)]) });

      const chart = page.getByRole("figure", { name: FILL_WEIGHT_PLOT.title });
      await expect.element(chart).toBeVisible();
      await expect.poll(() => crowdedTexts(chart)).toStrictEqual([]);

      const line = chart.element().querySelector("polyline")?.getBoundingClientRect();
      const names = drawnTexts(chart).filter(({ label }) => label?.endsWith("limit"));

      expect(names).toHaveLength(2);
      expect(names.every(({ box }) => box.left > (line?.right ?? 0))).toBe(true);

      const references = chart.getByRole("list", { name: "Reference lines" });
      await expect.element(references.getByText("Upper limit: 503 ml")).toBeInTheDocument();
    });
  });

  it("scales a plot with a larger browser text size, so its words don't overlap", async () => {
    document.documentElement.style.fontSize = "200%";

    onTestFinished(() => {
      document.documentElement.style.removeProperty("font-size");
    });

    await atViewport(NARROW_PHONE, async () => {
      renderLessonPlayer({ lesson: buildLesson([check(FILL_WEIGHT_PLOT)]) });

      const chart = page.getByRole("figure", { name: FILL_WEIGHT_PLOT.title });
      await expect.element(chart).toBeVisible();
      await expect.poll(() => crowdedTexts(chart)).toStrictEqual([]);
    });
  });

  it("tells two series apart with a legend, by shape as well as color", async () => {
    const twoSeries: PlotVisual = {
      ...DETECTOR_SCAN_PLOT,
      series: [
        ...DETECTOR_SCAN_PLOT.series,
        {
          mark: "line",
          name: "Last week",
          points: [0.5, 1.5, 3, 4.5, 5.5].map((x) => ({ label: null, x, y: 800 + x * 10 })),
        },
      ],
      title: "Detector scan, this week and last",
    };

    renderLessonPlayer({ lesson: buildLesson([check(twoSeries)]) });

    const chart = page.getByRole("figure", { name: twoSeries.title });
    await expect.element(chart).toBeVisible();
    await expect.element(chart.getByText("Last week", { exact: true }).first()).toBeVisible();

    const swatches = [...chart.element().querySelectorAll("li svg path")];
    expect(new Set(swatches.map((shape) => shape.getAttribute("d"))).size).toBe(2);
    expect(new Set(swatches.map((shape) => getComputedStyle(shape).color)).size).toBe(2);
  });
});
