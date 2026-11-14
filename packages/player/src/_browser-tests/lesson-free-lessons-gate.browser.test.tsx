import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { type LessonPlayerAdapters, type LessonStartOutcome } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";

function freeLessonsUsed(opensInMs: number): LessonStartOutcome {
  return {
    availableAt: new Date(Date.now() + opensInMs).toISOString(),
    period: "rolling30Days",
    reason: "limitReached",
    tier: "free",
  };
}

describe("the free lessons gate", () => {
  it("offers to start the lesson once its free lesson opens, and asks the server again", async () => {
    const lesson = buildLesson([teachingStep("check")]);

    const startLesson = vi
      .fn<LessonPlayerAdapters["startLesson"]>()
      .mockResolvedValueOnce(freeLessonsUsed(1500))
      .mockResolvedValue(freeLessonsUsed(MS_PER_DAY));

    renderLessonPlayer({ adapters: buildAdapters(lesson, { startLesson }), lesson });

    await expect
      .element(page.getByRole("heading", { name: "You've used your free lessons" }))
      .toBeVisible();

    expect(page.getByRole("button", { name: /^Start the lesson/u }).query()).toBeNull();

    await expect
      .element(page.getByRole("heading", { name: "Your next free lesson is ready" }))
      .toBeVisible();

    await expect.element(page.getByRole("link", { name: "Subscribe" })).toBeVisible();
    await page.getByRole("button", { name: /^Start the lesson/u }).click();

    await expect.poll(() => startLesson.mock.calls).toHaveLength(2);

    await expect
      .element(
        page.getByText(/Your next free lesson opens tomorrow, or subscribe to keep going\.$/u),
      )
      .toBeVisible();
  });
});
