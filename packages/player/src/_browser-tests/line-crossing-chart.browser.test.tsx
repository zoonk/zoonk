import {
  activityContentFixtures,
  engineModeFixtures,
} from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";
import {
  checkActivity,
  expectVerdict,
  openActivity,
  pressOnSlider,
  valueInput,
} from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { previewEntries } from "../preview/preview-catalog";
import { buildLesson } from "../preview/preview-lesson";
import { activityStep, explanationStep } from "../preview/preview-steps";

const PHONE = { height: 812, width: 375 };
const WIDE = { height: 812, width: 480 };
const NARROW = { height: 812, width: 320 };
const HALO = 2;
const { breakEven } = engineModeFixtures.lineCrossing;
const supplyDemand = activityContentFixtures.lineCrossing;

const flatCost = {
  ...breakEven,
  fields: {
    ...breakEven.fields,
    lines: [
      { id: "cost", intercept: 500, label: "Cost", slope: 0 },
      { id: "revenue", intercept: 0, label: "Revenue", slope: 15 },
    ],
  },
};

const flatCostToMove = { ...flatCost, check: supplyDemand.check };

const supplyDemandUpAndDown = {
  ...supplyDemand,
  fields: {
    ...supplyDemand.fields,
    shift: { amount: 2, direction: "down" as const, line: "supply" },
  },
};

function lineName(name: string): SVGTextElement {
  const label = [...document.querySelectorAll<SVGTextElement>("figure svg text")].find(
    (text) => text.textContent === name,
  );

  if (!label) {
    throw new Error(`No line named ${name}`);
  }

  return label;
}

function lineOf(label: SVGTextElement): SVGPathElement {
  const color = getComputedStyle(label).fill;

  const line = [...document.querySelectorAll<SVGPathElement>("figure svg g[clip-path] path")].find(
    (path) => getComputedStyle(path).stroke === color && !path.getAttribute("stroke-dasharray"),
  );

  if (!line) {
    throw new Error(`No line drawn for ${label.textContent}`);
  }

  return line;
}

function gapTo(box: DOMRect, point: { x: number; y: number }): number {
  return Math.hypot(
    Math.max(box.left - point.x, 0, point.x - box.right),
    Math.max(box.top - point.y, 0, point.y - box.bottom),
  );
}

function gapToLine(label: SVGTextElement, line: SVGPathElement): number {
  const box = label.getBoundingClientRect();
  const matrix = line.getScreenCTM();
  const length = line.getTotalLength();

  const points = Array.from({ length: 401 }, (_, index) =>
    line.getPointAtLength((length * index) / 400).matrixTransform(matrix ?? undefined),
  );

  return (
    Math.min(...points.map((point) => gapTo(box, point))) -
    Number(line.getAttribute("stroke-width")) / 2
  );
}

function gapToHandle(label: SVGTextElement, name: string): number {
  const ring = page.getByRole("slider", { name }).element().querySelector("circle.fill-background");

  if (!ring) {
    throw new Error(`No handle for ${name}`);
  }

  const box = ring.getBoundingClientRect();
  const center = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  return gapTo(label.getBoundingClientRect(), center) - box.width / 2;
}

type Bounds = { bottom: number; left: number; right: number; top: number };

function plotBounds(): Bounds {
  const svg = document.querySelector("figure svg");
  const plot = svg?.querySelector("clipPath rect");

  if (!svg || !plot) {
    throw new Error("No plot drawn");
  }

  const chart = svg.getBoundingClientRect();

  const [left, top] = [
    chart.left + Number(plot.getAttribute("x")),
    chart.top + Number(plot.getAttribute("y")),
  ];

  return {
    bottom: top + Number(plot.getAttribute("height")),
    left,
    right: left + Number(plot.getAttribute("width")),
    top,
  };
}

function chartBounds(): Bounds {
  const chart = document.querySelector("figure svg")?.getBoundingClientRect();

  if (!chart) {
    throw new Error("No chart drawn");
  }

  return chart;
}

function handlesOutsideTheChart(names: readonly string[], bounds: () => Bounds): string[] {
  const plot = bounds();

  return names.filter((name) => {
    const ring = page
      .getByRole("slider", { name: `Move the line ${name}` })
      .element()
      .querySelector("circle.fill-background")
      ?.getBoundingClientRect();

    return (
      !ring ||
      ring.left < plot.left ||
      ring.right > plot.right ||
      ring.top < plot.top ||
      ring.bottom > plot.bottom
    );
  });
}

async function handlesOutsideAtEachEnd(
  names: readonly string[],
  bounds: () => Bounds = plotBounds,
): Promise<string[]> {
  const outside: string[] = [];

  for (const name of names) {
    for (const key of ["Home", "End"]) {
      // oxlint-disable-next-line no-await-in-loop -- Each move lands before the handles are read.
      await pressOnSlider(`Move the line ${name}`, key, 1);

      outside.push(
        ...handlesOutsideTheChart(names, bounds).map(
          (handle) => `${handle} with ${name} at ${key}`,
        ),
      );
    }
  }

  return outside;
}

function handleGapsFromTheCrossing(names: readonly string[]): number[] {
  const dot = document.querySelector("figure svg circle.fill-foreground")?.getBoundingClientRect();

  return names.map((name) => {
    const ring = page
      .getByRole("slider", { name: `Move the line ${name}` })
      .element()
      .querySelector("circle.fill-background")
      ?.getBoundingClientRect();

    if (!dot || !ring) {
      return Number.NEGATIVE_INFINITY;
    }

    const between = Math.hypot(
      ring.left + ring.width / 2 - (dot.left + dot.width / 2),
      ring.top + ring.height / 2 - (dot.top + dot.height / 2),
    );

    return between - ring.width / 2 - dot.width / 2;
  });
}

function arrowHeads(): Bounds[] {
  const svg = document.querySelector<SVGSVGElement>("figure svg");
  const marker = svg?.querySelector("marker");

  if (!svg || !marker) {
    throw new Error("No change arrows drawn");
  }

  const view = marker.viewBox.baseVal;
  const [refX, refY] = [marker.refX.baseVal.value, marker.refY.baseVal.value];
  const matrix = svg.getScreenCTM() ?? undefined;

  return [...svg.querySelectorAll<SVGPathElement>("path[marker-end]")].map((arrow) => {
    const strokeWidth = Number(arrow.getAttribute("stroke-width"));
    const unit = (marker.markerWidth.baseVal.value * strokeWidth) / view.width;
    const start = arrow.getPointAtLength(0);
    const end = arrow.getPointAtLength(arrow.getTotalLength());
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const along = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };

    const corners = [-refX, view.width - refX].flatMap((forward) =>
      [-refY, view.height - refY].map((side) =>
        new DOMPoint(
          end.x + (forward * along.x - side * along.y) * unit,
          end.y + (forward * along.y + side * along.x) * unit,
        ).matrixTransform(matrix),
      ),
    );

    const [xs, ys] = [corners.map((corner) => corner.x), corners.map((corner) => corner.y)];

    return {
      bottom: Math.max(...ys),
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.min(...ys),
    };
  });
}

function gapBetween(box: Bounds, other: Bounds): number {
  return Math.hypot(
    Math.max(other.left - box.right, 0, box.left - other.right),
    Math.max(other.top - box.bottom, 0, box.top - other.bottom),
  );
}

async function expectNamesOffTheirLines() {
  await expect.element(page.getByRole("slider", { name: "Move the line Revenue" })).toBeVisible();
  const revenue = lineName("Revenue");
  const cost = lineName("Cost");

  expect(gapToLine(revenue, lineOf(revenue))).toBeGreaterThan(HALO);
  expect(gapToLine(cost, lineOf(cost))).toBeGreaterThan(HALO);
}

describe("line crossing chart", () => {
  it("keeps each line's name off its own line when explored", async () => {
    const entry = previewEntries.find((item) => item.id === "activity-lineCrossing-breakEven");

    await atViewport(PHONE, async () => {
      renderLessonPlayer({ lesson: buildLesson(entry ? [entry.screen("explore")] : []) });
      await expectNamesOffTheirLines();
    });
  });

  it("keeps each line's name off its own line once answered", async () => {
    await atViewport(PHONE, async () => {
      openActivity({ content: breakEven, template: "lineCrossing" });
      await valueInput().fill("250");
      await checkActivity();
      await expectVerdict("Correct!");
      await expectNamesOffTheirLines();
    });
  });

  it("keeps the handles off the line names at the top of the range, in large text", async () => {
    document.documentElement.style.fontSize = "200%";

    onTestFinished(() => {
      document.documentElement.style.removeProperty("font-size");
    });

    await atViewport(PHONE, async () => {
      openActivity({ content: breakEven, template: "lineCrossing" });
      await pressOnSlider("Move the line Cost", "ArrowUp", 8);

      const gaps = ["Revenue", "Cost"].flatMap((name) =>
        ["Move the line Revenue", "Move the line Cost"].map((handle) =>
          gapToHandle(lineName(name), handle),
        ),
      );

      expect(Math.min(...gaps)).toBeGreaterThan(HALO);
    });
  });

  it("keeps every handle inside the chart at both ends of each line's range", async () => {
    await atViewport(PHONE, async () => {
      openActivity({ template: "lineCrossing" });
      await expect(handlesOutsideAtEachEnd(["Supply", "Demand"])).resolves.toStrictEqual([]);
    });
  });

  it("keeps every handle inside the chart at both ends of each line's range, moved up and down", async () => {
    await atViewport(PHONE, async () => {
      openActivity({ content: breakEven, template: "lineCrossing" });
      await expect(handlesOutsideAtEachEnd(["Cost", "Revenue"])).resolves.toStrictEqual([]);
    });
  });

  it("keeps a flat line's handle on the chart when its slide would leave it", async () => {
    await atViewport(PHONE, async () => {
      openActivity({ content: flatCost, template: "lineCrossing" });
      await expect(handlesOutsideAtEachEnd(["Cost", "Revenue"])).resolves.toStrictEqual([]);
    });
  });

  it("rests each handle clear of the crossing, and on the chart at both ends", async () => {
    await atViewport(PHONE, async () => {
      openActivity({ content: supplyDemandUpAndDown, template: "lineCrossing" });

      await expect
        .element(page.getByRole("slider", { name: "Move the line Demand" }))
        .toBeVisible();

      expect(Math.min(...handleGapsFromTheCrossing(["Supply", "Demand"]))).toBeGreaterThan(0);

      await expect(handlesOutsideAtEachEnd(["Supply", "Demand"])).resolves.toStrictEqual([]);
    });
  });

  it("keeps a handle's value in its range when the chart narrows at the end of its slide", async () => {
    await atViewport(WIDE, async () => {
      openActivity({ template: "lineCrossing" });
      await pressOnSlider("Move the line Supply", "End", 1);
      const wide = plotBounds().right;

      await page.viewport(NARROW.width, NARROW.height);
      await expect.poll(() => plotBounds().right).toBeLessThan(wide);

      const supply = page.getByRole("slider", { name: "Move the line Supply" }).element();

      expect(Number(supply.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(
        Number(supply.getAttribute("aria-valuemax")),
      );

      expect(handlesOutsideTheChart(["Supply", "Demand"], plotBounds)).toStrictEqual([]);
    });
  });

  it("keeps the Before name clear of the change arrows, heads included", async () => {
    await atViewport(PHONE, async () => {
      openActivity({ template: "lineCrossing" });
      await pressOnSlider("Move the line Demand", "End", 1);
      const before = lineName("Before").getBoundingClientRect();

      expect(Math.min(...arrowHeads().map((head) => gapBetween(before, head)))).toBeGreaterThan(
        HALO,
      );
    });
  });

  it("keeps every handle inside the chart at both ends on a narrow phone in large text", async () => {
    document.documentElement.style.fontSize = "200%";

    onTestFinished(() => {
      document.documentElement.style.removeProperty("font-size");
    });

    await atViewport(NARROW, async () => {
      openActivity({ template: "lineCrossing" });

      await expect
        .poll(() => {
          const plot = document.querySelector('[data-slot="activity-plot"]');
          const { left, right } = chartBounds();
          return plot && plot.clientWidth - (right - left);
        })
        .toBe(0);

      await expect(
        handlesOutsideAtEachEnd(["Supply", "Demand"], chartBounds),
      ).resolves.toStrictEqual([]);
    });
  });

  it("brings a checked move back the way it was answered when the learner returns", async () => {
    renderLessonPlayer({
      lesson: buildLesson([
        activityStep({ content: supplyDemand }),
        explanationStep({ text: "Next.", title: "Next" }),
      ]),
    });

    await pressOnSlider("Move the line Supply", "ArrowLeft", 1);
    await checkActivity();
    await expectVerdict("Correct!");
    await page.getByRole("button", { name: /^Continue/u }).click();
    await page.getByRole("button", { name: "Previous screen" }).click();

    await expect
      .element(page.getByRole("slider", { name: "Move the line Supply" }))
      .toHaveAttribute("aria-valuenow", "-2");

    await expect.element(page.getByText("People didn't want more eggs.")).not.toBeInTheDocument();
  });

  it("brings a move back no further than its line can go", async () => {
    renderLessonPlayer({
      lesson: buildLesson([
        activityStep({ content: flatCostToMove }),
        explanationStep({ text: "Next.", title: "Next" }),
      ]),
    });

    await pressOnSlider("Move the line Cost", "ArrowDown", 1);
    await checkActivity();
    await expectVerdict("Not quite");
    await page.getByRole("button", { name: /^Continue/u }).click();
    await page.getByRole("button", { name: "Previous screen" }).click();
    const cost = page.getByRole("slider", { name: "Move the line Cost" });

    await expect.element(cost).toHaveAttribute("aria-valuenow", "-250");
    await expect.element(cost).toHaveAttribute("aria-valuemin", "-250");
  });
});
