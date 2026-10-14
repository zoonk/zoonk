import { pictureCheckContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { page } from "vitest/browser";
import { expectAccessibleScreen } from "../_test-utils/accessibility";
import { expectCount, press } from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import { inlineImage, pictureCheckStep } from "../preview/preview-steps";

/**
 * A question whose options are pictures, to tell separate things apart by how they look: each is
 * named by what it looks like until the answer is checked, waited for while it's drawn, and
 * described in words when its drawing never came.
 */

const [GOTHIC, ROMANESQUE, BAROQUE] = pictureCheckContent.options;
const PHONE = { height: 812, width: 375 };

/** The player asks again for pictures still being drawn every 4 seconds. */
const PICTURE_POLL_MS = 4000;

function option(alt: string) {
  return page.getByRole("radio", { name: new RegExp(alt, "u") });
}

/** Checks the pick and waits for the verdict the check screen announces. */
async function checkAnswer(expected: "Correct!" | "Not quite") {
  await page.getByRole("button", { name: /^Check/u }).click();
  await expect.element(page.getByRole("status").filter({ hasText: expected })).toBeVisible();
}

describe("picture options", () => {
  it("picks a picture by what it looks like, and keeps only the named right one once checked", async () => {
    renderLessonPlayer({ lesson: buildLesson([pictureCheckStep()]) });

    await expect.element(page.getByRole("img", { name: GOTHIC?.picture.alt })).toBeVisible();
    // The names would give the answer away, so they wait for the check.
    await expect.element(page.getByText("Romanesque", { exact: true })).not.toBeInTheDocument();

    await option(GOTHIC?.picture.alt ?? "").click();
    await checkAnswer("Correct!");

    // Only the right pick stays, named; the others step aside for the result.
    await expect.element(page.getByText("Gothic", { exact: true })).toBeVisible();
    await expectCount(page.getByRole("radio"), 1);
    await expect.element(page.getByText("Romanesque", { exact: true })).not.toBeInTheDocument();
    await expect.element(page.getByText("Baroque", { exact: true })).not.toBeInTheDocument();
  });

  it("picks with a number key, and marks a wrong pick next to the right one", async () => {
    renderLessonPlayer({ lesson: buildLesson([pictureCheckStep()]) });

    await expect.element(page.getByRole("img", { name: ROMANESQUE?.picture.alt })).toBeVisible();
    await press("2");

    await expect
      .element(option(ROMANESQUE?.picture.alt ?? ""))
      .toHaveAttribute("aria-checked", "true");

    await checkAnswer("Not quite");
    await expect.element(page.getByText(ROMANESQUE?.reason ?? "")).toBeVisible();
  });

  it("holds the question while a picture is drawn, then takes answers once it arrives", async () => {
    // The clock keeps running on its own, as the lesson's does, so only the wait is skipped ahead.
    vi.useFakeTimers({ shouldAdvanceTime: true });

    onTestFinished(() => {
      vi.useRealTimers();
    });

    const step = pictureCheckStep({ drawn: ["gothic", "romanesque"], imagePending: true });
    const lesson = buildLesson([step]);
    const drawn = inlineImage({ alt: BAROQUE?.picture.alt ?? "" });

    const getLessonPictures = vi
      .fn<NonNullable<LessonPlayerAdapters["getLessonPictures"]>>()
      .mockResolvedValue([]);

    renderLessonPlayer({ adapters: buildAdapters(lesson, { getLessonPictures }), lesson });

    await expect
      .element(page.getByRole("status").filter({ hasText: "Drawing the picture…" }))
      .toBeInTheDocument();

    await expect.element(page.getByRole("radio").first()).toBeDisabled();

    // The picture is drawn, and the next ask, a few seconds later, brings it.
    getLessonPictures.mockResolvedValue([{ image: drawn, optionId: "baroque", stepId: step.id }]);
    await vi.advanceTimersByTimeAsync(PICTURE_POLL_MS);

    await expect.element(page.getByRole("img", { name: BAROQUE?.picture.alt })).toBeVisible();
    await expect.element(page.getByRole("radio").first()).toBeEnabled();
  });

  it("describes a picture that never came, so the question still plays", async () => {
    renderLessonPlayer({
      lesson: buildLesson([pictureCheckStep({ drawn: ["gothic", "romanesque"] })]),
    });

    await expect.element(page.getByText(BAROQUE?.picture.alt ?? "")).toBeVisible();
    await option(BAROQUE?.picture.alt ?? "").click();
    await checkAnswer("Not quite");
  });

  it("fits a phone and is accessible in light and dark", async () => {
    await atViewport(PHONE, async () => {
      renderLessonPlayer({ lesson: buildLesson([pictureCheckStep()]) });

      await expect.element(page.getByRole("img", { name: BAROQUE?.picture.alt })).toBeVisible();
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(PHONE.width);
      await expectAccessibleScreen("picture options");
    });
  });
});
