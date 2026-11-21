import { challengeChartCaseFixture } from "@zoonk/testing/fixtures/challenge-chart-case";
import { describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";
import { press } from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { onDevice } from "../_test-utils/device-media";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { contentStep } from "../preview/preview-steps";

const TEAM = { language: "en", members: [{ name: "Ana" }, { name: "Bruno" }] };

function renderChartCase() {
  renderLessonPlayer({
    challengeTeam: TEAM,
    lesson: buildLesson([contentStep("challenge", { content: challengeChartCaseFixture() })], {
      title: "Challenge: reading a scan",
    }),
  });
}

function containerLive(element: Element): string | null {
  const root = element.closest("[aria-live], [role='log'], [role='status'], [role='alert']");
  return root?.getAttribute("aria-live") ?? (root ? "polite" : null);
}

function topInLog(element: Element): number {
  const log = page.getByRole("log").element();
  return element.getBoundingClientRect().top - log.getBoundingClientRect().top;
}

describe("challenge charts", () => {
  it("draws a decision's chart between the messages and the question", async () => {
    renderChartCase();
    await press("Enter");

    const chart = page.getByRole("figure", { name: "Detector scan" });
    await expect.element(chart).toBeVisible();

    const message = page.getByText("C has the highest count. I'd park it there and go home.");

    const prompt = page.getByRole("heading", {
      name: "Where do you put the detector for the night?",
    });

    const messageBox = message.element().getBoundingClientRect();
    const chartBox = chart.element().getBoundingClientRect();

    expect(chartBox.top).toBeGreaterThanOrEqual(messageBox.bottom);
    expect(prompt.element().getBoundingClientRect().top).toBeGreaterThanOrEqual(chartBox.bottom);
    expect(page.getByRole("log").element().contains(chart.element())).toBe(true);
  });

  it("announces a decision's chart by its title and leaves its data for the learner to move through", async () => {
    renderChartCase();
    await press("Enter");

    const chart = page.getByRole("figure", { name: "Detector scan" });
    await expect.element(chart).toBeVisible();

    const title = chart.element().querySelector("figcaption");
    const cell = chart.getByRole("cell", { name: "952 counts/s" });
    await expect.element(cell).toBeInTheDocument();

    expect(title && containerLive(title)).toBe("polite");
    expect(containerLive(cell.element())).toBe("off");
  });

  it("keeps the chart where it was after the pick and brings the next chart's top into view", async () => {
    await onDevice({ reducedMotion: "reduce" }, () =>
      atViewport({ height: 640, width: 375 }, async () => {
        renderChartCase();
        await press("Enter");

        const first = page.getByRole("figure", { name: "Detector scan" });
        await expect.element(first).toBeVisible();
        const drawn = first.element();
        const top = topInLog(drawn);

        await page.getByRole("radio", { name: "Scan again in finer steps from B to D" }).click();
        await page.getByRole("button", { name: /^Check/u }).click();

        const next = page.getByRole("figure", { name: "Finer scan, B to D" });
        await expect.element(next).toBeVisible();

        expect(first.element()).toBe(drawn);
        expect(topInLog(drawn)).toBe(top);

        await expect
          .poll(() => next.element().getBoundingClientRect().top)
          .toBeGreaterThanOrEqual(0);

        await expect
          .poll(() => next.element().getBoundingClientRect().top)
          .toBeLessThan(window.innerHeight);
      }),
    );
  });

  it("brings the next decision into view without moving the page sideways at a large text size", async () => {
    document.documentElement.style.fontSize = "200%";

    onTestFinished(() => {
      document.documentElement.style.removeProperty("font-size");
    });

    await onDevice({ reducedMotion: "reduce" }, () =>
      atViewport({ height: 640, width: 360 }, async () => {
        renderChartCase();
        await press("Enter");

        await expect.element(page.getByRole("figure", { name: "Detector scan" })).toBeVisible();
        await page.getByRole("radio", { name: "Scan again in finer steps from B to D" }).click();
        await page.getByRole("button", { name: /^Check/u }).click();

        const next = page.getByRole("figure", { name: "Finer scan, B to D" });
        await expect.element(next).toBeVisible();

        await expect
          .poll(() => next.element().getBoundingClientRect().top)
          .toBeLessThan(window.innerHeight);

        const scrolledSideways = [...document.querySelectorAll<HTMLElement>("html, html *")]
          .filter((element) => element.scrollLeft !== 0)
          .map((element) => element.dataset.slot ?? element.tagName);

        expect(scrolledSideways).toStrictEqual([]);
      }),
    );
  });
});
