import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";
import { checkActivity, openActivity, pressOnSlider } from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { computeActivityValue } from "../activities/_utils/compute-activity-value";

const base = activityContentFixtures.distributionExplorer;
const normal = { kind: "normal", mean: 100, sd: 15 } as const;
const uniform = { kind: "uniform", max: 200, min: 0 } as const;

const mean = {
  distribution: normal,
  handle: "Lower handle",
  handles: { from: 95, to: 110 },
  target: { from: 70, to: 130 },
};

const right = {
  distribution: normal,
  handle: "Lower handle",
  handles: { from: 105, to: 120 },
  target: { from: 95, to: 100 },
};

const edge = {
  distribution: uniform,
  handle: "Lower handle",
  handles: { from: 5, to: 150 },
  target: { from: 0, to: 50 },
};

const setups = [
  { name: "normal near mean", ...mean },
  { name: "normal near mean (review 200%)", ...mean },
  { name: "normal near mean (review 150%)", ...mean },
  {
    distribution: normal,
    handle: "Upper handle",
    handles: { from: 80, to: 90 },
    name: "narrow target right of handles",
    target: { from: 100, to: 105 },
  },
  { name: "narrow target, handles right", ...right },
  { name: "uniform target near edge", ...edge },
  {
    distribution: uniform,
    handle: "Upper handle",
    handles: { from: 20, to: 185 },
    name: "uniform target near right edge",
    target: { from: 150, to: 200 },
  },
  {
    distribution: uniform,
    handle: "Lower handle",
    handles: { from: 75, to: 140 },
    name: "uniform target mid",
    target: { from: 70, to: 130 },
  },
  {
    distribution: uniform,
    handle: "Lower handle",
    handles: { from: 5, to: 190 },
    name: "uniform wide target",
    target: { from: 0, to: 200 },
  },
  { name: "uniform (review 200%)", ...edge },
  { name: "normal narrow (review 200%)", ...right },
];

function gap(a: DOMRect, b: DOMRect): number {
  return Math.max(a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom);
}

function assertPlacement(svg: SVGSVGElement) {
  const axis = svg.querySelector<SVGPathElement>("path.stroke-viz-grid")!.getBoundingClientRect();
  const handle = svg.querySelector<SVGPathElement>('[role="slider"] path')!.getBoundingClientRect();
  const target = svg.querySelector("text.fill-success")!;
  expect(target).not.toBeNull();

  const obstacles = [
    target,
    ...svg.querySelectorAll('[role="slider"] rect,[role="slider"] text,text.fill-muted-foreground'),
  ];

  const curve = svg.querySelector<SVGPathElement>("path.stroke-viz-accent.fill-none")!;
  const matrix = curve.getScreenCTM()!;
  const length = curve.getTotalLength();

  const points = Array.from({ length: Math.ceil(length * 2) + 1 }, (_, index) =>
    curve.getPointAtLength(Math.min(index / 2, length)).matrixTransform(matrix),
  );

  const tails = [
    ...svg.querySelectorAll<SVGTextElement>('text[dominant-baseline="text-after-edge"]'),
  ].filter((label) => getComputedStyle(label).visibility !== "hidden");

  for (const label of tails) {
    const box = label.getBoundingClientRect();
    expect(box.width).toBeGreaterThan(0);
    expect(box.left).toBeGreaterThanOrEqual(axis.left + 2);
    expect(box.right).toBeLessThanOrEqual(axis.right - 2);
    expect(box.top).toBeGreaterThanOrEqual(handle.top + 2);
    expect(box.bottom).toBeLessThanOrEqual(axis.top - 2);

    for (const obstacle of obstacles) {
      expect(
        gap(box, obstacle.getBoundingClientRect()),
        `${label.textContent} against ${obstacle.textContent}`,
      ).toBeGreaterThanOrEqual(2);
    }

    const clearance = Math.min(
      ...points.map((point) =>
        Math.hypot(
          Math.max(box.left - point.x, 0, point.x - box.right),
          Math.max(box.top - point.y, 0, point.y - box.bottom),
        ),
      ),
    );

    expect(clearance, `${label.textContent} against curve`).toBeGreaterThanOrEqual(2.5);
  }

  return tails;
}

describe.each([390, 1440])("distribution tail placement at %ipx", (width) => {
  describe.each(["100%", "200%"])("text %s", (font) => {
    it.each(setups)("$name", async (setup) => {
      document.documentElement.style.fontSize = font;

      onTestFinished(() => {
        document.documentElement.style.removeProperty("font-size");
      });

      await atViewport({ height: 844, width }, async () => {
        const fields = {
          ...base.fields,
          distribution: setup.distribution,
          handles: setup.handles,
          target: setup.target,
        };

        const answer = computeActivityValue({ ...base, fields, template: "distributionExplorer" })!;

        openActivity({
          content: { ...base, check: { ...base.check, answer }, fields },
          template: "distributionExplorer",
        });

        await pressOnSlider(setup.handle, "ArrowRight", 1);
        await checkActivity();
        await expect.element(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();

        await expect
          .poll(() => {
            const svg = document.querySelector<SVGSVGElement>("figure svg")!;
            const tails = assertPlacement(svg);

            const minimum = font === "100%" && setup.name === "normal near mean" ? 1 : 0;
            expect(tails.length).toBeGreaterThanOrEqual(minimum);

            return true;
          })
          .toBe(true);
      });
    });
  });
});
