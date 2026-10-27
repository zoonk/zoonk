import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { explanationStep, teachingStep } from "../preview/preview-steps";

describe("lesson sounds", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not play a second chime when Previous returns to a right answer", async () => {
    // Observe the browser's audio output while playing the real lesson and sound effects.
    const notes = vi.spyOn(OscillatorNode.prototype, "start");

    renderLessonPlayer({
      lesson: buildLesson([
        teachingStep("check"),
        explanationStep({ text: "An orbital describes probability.", title: "Orbitals" }),
      ]),
      soundsEnabled: true,
    });

    await page
      .getByRole("radio", { name: "Where the electron is most likely to be found" })
      .click();

    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
    expect(notes).toHaveBeenCalledTimes(2);

    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("heading", { name: "Orbitals" })).toBeVisible();
    await page.getByRole("button", { name: "Previous screen" }).click();
    await expect.element(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
    expect(notes).toHaveBeenCalledTimes(2);
  });
});
