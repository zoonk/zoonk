import { settleAnimations } from "@zoonk/testing/accessibility/scan";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { onDevice } from "../_test-utils/device-media";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson, localAdapters } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";

async function captureOpenAnswer(width: number, colorScheme: "light" | "dark", state = "empty") {
  await page.viewport(width, 900);

  await onDevice({ colorScheme, reducedMotion: "reduce" }, async () => {
    await expect.poll(() => settleAnimations(3000), { timeout: 15_000 }).toBe(0);

    await page.screenshot({
      path: `../../.vitest/attachments/walk-fixes-learn/open-answer-${state}-${width}-${colorScheme}.png`,
    });
  });
}

const SAMPLE_ANSWER =
  "Because we can't pin down where the electron is. The cloud maps where it's most likely to be.";

function verdict(text: string) {
  return page.getByRole("status").filter({ hasText: text });
}

describe("open answer skip", () => {
  it("shows a good answer, then finishes without grading, when the learner doesn't know either open answer", async () => {
    const first = teachingStep("typedAnswer");
    const last = teachingStep("typedAnswer");
    const lesson = buildLesson([first, teachingStep("explanation"), last]);
    const local = localAdapters(lesson);

    const adapters = buildAdapters(lesson, {
      completeLesson: vi.fn(async (input) => {
        const result = await local.completeLesson(input);

        return result.status === "completed"
          ? { ...result, completion: { ...result.completion, correctCount: 0 } }
          : result;
      }),
    });

    renderLessonPlayer({ adapters, lesson });

    await expect.element(page.getByRole("button", { name: /^Check/u })).toBeDisabled();
    await captureOpenAnswer(390, "light");
    await captureOpenAnswer(390, "dark");
    await captureOpenAnswer(1440, "light");
    await captureOpenAnswer(1440, "dark");
    await page.viewport(1280, 720);

    await page.getByRole("button", { name: "I don't know yet" }).click();

    // What a good answer says, before going on: no verdict on an answer the learner didn't give.
    await expect.element(verdict("Here's a good answer")).toBeVisible();
    await expect.element(verdict(SAMPLE_ANSWER)).toBeVisible();
    await expect.element(verdict("Not quite")).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: /^Continue/u })).toHaveFocus();
    await captureOpenAnswer(390, "light", "dont-know");
    await captureOpenAnswer(1440, "light", "dont-know");
    await page.viewport(1280, 720);

    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByText("A cloud, not a little ball")).toBeVisible();
    await page.getByRole("button", { name: /^Next/u }).click();
    await expect.element(page.getByRole("textbox")).toBeVisible();
    await page.getByRole("textbox").fill("An unfinished thought");
    await captureOpenAnswer(390, "light", "typed");
    await captureOpenAnswer(390, "dark", "typed");
    await captureOpenAnswer(1440, "light", "typed");
    await captureOpenAnswer(1440, "dark", "typed");
    await page.getByRole("button", { name: "I don't know yet" }).click();
    await expect.element(verdict(SAMPLE_ANSWER)).toBeVisible();
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    await expect.element(page.getByText("1 of 1 right")).not.toBeInTheDocument();
    await captureOpenAnswer(390, "light", "complete");
    await captureOpenAnswer(390, "dark", "complete");
    await captureOpenAnswer(1440, "light", "complete");
    await captureOpenAnswer(1440, "dark", "complete");
    await page.viewport(1280, 720);
    expect(adapters.checkStep).not.toHaveBeenCalled();

    expect(adapters.completeLesson).toHaveBeenCalledExactlyOnceWith({
      runId: expect.any(String),
      skippedWritingStepIds: [first.id, last.id],
    });
  });
});
