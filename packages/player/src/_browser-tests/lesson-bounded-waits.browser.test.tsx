import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { CHECK_BOUNDS } from "../lesson/use-step-grading";
import { buildLesson } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";

const TYPO = "It shows where the electorn is likely to be";

function hang<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

describe("bounded waits", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("a typed answer's check says it's still going, then checks it again under the same id", async () => {
    const lesson = buildLesson([teachingStep("typedAnswer"), teachingStep("summary")]);

    const checkStep = vi
      .fn<LessonPlayerAdapters["checkStep"]>()
      .mockImplementationOnce(() => hang())
      .mockResolvedValueOnce({
        result: {
          checked: true,
          correctAnswer: null,
          corrections: [],
          expected: null,
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

    const check = page.getByRole("button", { name: /^Check/u });
    await check.click();
    await expect.element(check).toHaveAttribute("aria-busy", "true");
    await expect.element(check).toBeDisabled();

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

    const [first, again] = checkStep.mock.calls.map(([input]) => input.attemptId);
    expect(again).toBe(first);
  });
});
