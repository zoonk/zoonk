import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { teachingStep } from "../_test-utils/lesson-steps";
import {
  buildAdapters,
  buildLesson,
  renderLessonPlayer,
} from "../_test-utils/render-lesson-player";
import { VARIANT_BOUNDS } from "../lesson/controls/use-step-variant";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { CHECK_BOUNDS } from "../lesson/use-step-grading";

/**
 * Waits inside a lesson never hang: a typed answer's grade or a new version that takes longer than
 * usual says it's still going, and past its limit the screen stops waiting and offers to try
 * again. The first request never answers, like a stuck server; the next one does.
 */

const TYPO = "It shows where the electorn is likely to be";
const SIMPLER_TEXT = "Think of a blur instead of a dot.";

/** A request that never answers. */
function hang<T>(): Promise<T> {
  return new Promise<T>(() => {
    // Never settles, like a server that doesn't answer.
  });
}

describe("bounded waits", () => {
  // The clock keeps running on its own, as the lesson's does, so only the waits are skipped ahead.
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("a typed answer's check says it's still going, then offers to check again", async () => {
    const lesson = buildLesson([teachingStep("typedAnswer"), teachingStep("summary")]);

    const checkStep = vi
      .fn<LessonPlayerAdapters["checkStep"]>()
      .mockImplementationOnce(() => hang())
      .mockResolvedValueOnce({
        result: {
          correctAnswer: null,
          feedback: null,
          isCorrect: true,
          keyPoints: null,
          nextReviewAt: null,
          savedMistake: false,
          score: 1,
          spelling: "It shows where the electron is likely to be",
        },
        status: "checked",
      });

    renderLessonPlayer({ adapters: buildAdapters(lesson, { checkStep }), lesson });

    await page
      .getByRole("textbox", { name: "In your own words: why is the electron drawn as a cloud?" })
      .fill(TYPO);

    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(page.getByRole("button", { name: "Checking your answer" })).toBeDisabled();

    await vi.advanceTimersByTimeAsync(CHECK_BOUNDS.slowMs + 1000);

    await expect
      .element(page.getByText("Still checking. This is taking longer than usual."))
      .toBeVisible();

    await vi.advanceTimersByTimeAsync(CHECK_BOUNDS.timeoutMs.typed);

    await expect
      .element(page.getByText("We couldn't check your answer this time. Try again."))
      .toBeVisible();

    await page.getByRole("button", { name: /^Check/u }).click();

    await expect
      .element(page.getByRole("status").filter({ hasText: "Right, watch the spelling" }))
      .toBeVisible();

    expect(checkStep).toHaveBeenCalledTimes(2);
  });

  it("a new simpler version that takes too long offers to try again", async () => {
    const lesson = buildLesson([teachingStep("explanation"), teachingStep("check")]);

    const requestVariant = vi
      .fn<NonNullable<LessonPlayerAdapters["requestVariant"]>>()
      .mockImplementationOnce(() => hang())
      .mockResolvedValueOnce({
        content: { text: SIMPLER_TEXT, title: "A blur" },
        id: crypto.randomUUID(),
        status: "ready",
      });

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { requestVariant }),
      lesson,
      mode: "fun",
    });

    await expect.element(page.getByText("A cloud, not a little ball")).toBeVisible();
    await page.getByRole("button", { name: "Simpler" }).click();
    const simpler = page.getByRole("dialog", { name: "Simpler" });

    await expect
      .element(simpler.getByRole("progressbar", { name: "Writing this version" }))
      .toBeVisible();

    await vi.advanceTimersByTimeAsync(VARIANT_BOUNDS.slowMs + 1000);

    await expect
      .element(simpler.getByText("Still writing. This is taking longer than usual."))
      .toBeVisible();

    await vi.advanceTimersByTimeAsync(VARIANT_BOUNDS.timeoutMs);

    await expect
      .element(simpler.getByText("We couldn't write this version right now."))
      .toBeVisible();

    await simpler.getByRole("button", { name: "Try again" }).click();
    await expect.element(simpler.getByText(SIMPLER_TEXT)).toBeVisible();
  });
});
