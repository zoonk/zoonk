import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { press } from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { onDevice } from "../_test-utils/device-media";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";

const TEAM = { language: "en", members: [{ name: "Priya" }, { name: "Tom" }] };

describe("challenge lesson", () => {
  it("finishes a rushed case with one thing to improve and a practice", async () => {
    renderLessonPlayer({
      challengeTeam: TEAM,
      lesson: buildLesson([teachingStep("challenge")], { title: "Challenge: A/B tests" }),
    });

    await expect.element(page.getByText("Meeting with Tom today at 3 pm")).toBeVisible();
    await press("Enter");

    await expect
      .element(page.getByText("B won! 3.4% vs. 3.1%. Can I launch it today?"))
      .toBeVisible();

    await page.getByRole("radio", { name: "Go ahead and launch" }).click();
    await page.getByRole("button", { name: /^Check/u }).click();

    await expect
      .element(page.getByRole("heading", { name: "Priya has doubts. What now?" }))
      .toBeVisible();

    await page.getByRole("radio", { name: "Keep it live" }).click();
    await page.getByRole("button", { name: /^Check/u }).click();

    await press("Enter");
    await expect.element(page.getByText(/the early gap was chance/u)).toBeVisible();
    await expect.element(page.getByRole("heading", { name: "To improve" })).toBeVisible();

    await expect
      .element(page.getByText("One day of data can't tell a real gain from chance."))
      .toBeVisible();

    await expect.element(page.getByRole("heading", { name: "Next time, try…" })).toBeVisible();

    await press("Enter");
    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
  });

  it("opens the result at its title, not where the conversation was scrolled to", async () => {
    await onDevice({ reducedMotion: "reduce" }, () =>
      atViewport({ height: 640, width: 375 }, async () => {
        renderLessonPlayer({
          challengeTeam: TEAM,
          lesson: buildLesson([teachingStep("challenge")], { title: "Challenge: A/B tests" }),
        });

        await expect.element(page.getByText("Meeting with Tom today at 3 pm")).toBeVisible();
        await press("Enter");
        await page.getByRole("radio", { name: "Go ahead and launch" }).click();
        await page.getByRole("button", { name: /^Check/u }).click();
        await page.getByRole("radio", { name: "Keep it live" }).click();
        await page.getByRole("button", { name: /^Check/u }).click();

        await press("Enter");

        await expect
          .element(page.getByRole("heading", { name: "Challenge complete" }))
          .toBeInViewport({ ratio: 1 });
      }),
    );
  });
});
