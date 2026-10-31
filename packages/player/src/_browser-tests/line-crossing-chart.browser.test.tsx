import { engineModeFixtures } from "@zoonk/testing/fixtures/activity-contents";
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

const PHONE = { height: 812, width: 375 };
const HALO = 2;
const { breakEven } = engineModeFixtures.lineCrossing;

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
});
