import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { explanationWithSimpler, teachingStep } from "../_test-utils/lesson-steps";
import {
  type PlayerMode,
  buildLesson,
  renderLessonPlayer,
} from "../_test-utils/render-lesson-player";

/**
 * Struggle detection: two misses in a row on the same idea, or a long pause on an explanation,
 * offer a simpler version at that moment.
 */

const SIMPLER_TEXT = "Think of a blur instead of a dot.";

/** An explanation with a shared simpler version, then two checks on its idea. */
function createLesson() {
  return buildLesson([
    explanationWithSimpler(SIMPLER_TEXT),
    teachingStep("check"),
    teachingStep("check"),
  ]);
}

async function openLesson(mode: PlayerMode) {
  renderLessonPlayer({ lesson: createLesson(), mode });
  await expect.element(page.getByText("A cloud, not a little ball")).toBeVisible();
}

async function missCheck() {
  await page.getByRole("radio", { name: "The electron's size" }).click();
  await page.getByRole("button", { name: /^Check/u }).click();
  await expect.element(page.getByRole("status").filter({ hasText: "Not quite" })).toBeVisible();
}

describe("struggle help", () => {
  it("two misses in a row offer the idea's simpler explanation", async () => {
    await openLesson("focus");

    await page.getByRole("button", { name: /^Next/u }).click();
    await missCheck();

    const offer = page.getByText("This one is tricky. A simpler explanation might help.");
    await expect.element(offer).not.toBeInTheDocument();

    await page.getByRole("button", { name: /^Continue/u }).click();
    await missCheck();
    await expect.element(offer).toBeVisible();

    await page.getByRole("button", { name: "Show a simpler version" }).click();
    const simpler = page.getByRole("dialog", { name: "Simpler" });
    await expect.element(simpler.getByText(SIMPLER_TEXT)).toBeVisible();

    await simpler.getByRole("button", { name: "Got it" }).click();
    await expect.element(simpler).not.toBeInTheDocument();

    // "No thanks" puts the offer away; the lesson goes on as before.
    await page.getByRole("button", { name: "No thanks" }).click();
    await expect.element(offer).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: /^Continue/u })).toBeVisible();
  });

  it("a long pause on an explanation offers a simpler version", async () => {
    // The clock keeps running on its own, as the lesson's does, so only the pause is skipped ahead.
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      await openLesson("fun");

      const offer = page.getByText("Taking your time? A simpler version might help.");
      await vi.advanceTimersByTimeAsync(20_000);
      await expect.element(offer).not.toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(30_000);
      await expect.element(offer).toBeVisible();

      await page.getByRole("button", { name: "Show a simpler version" }).click();

      await expect
        .element(page.getByRole("dialog", { name: "Simpler" }).getByText(SIMPLER_TEXT))
        .toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });
});
