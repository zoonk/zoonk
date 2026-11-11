import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { ASIDE_COLLAPSED_ATTRIBUTE, ASIDE_COLLAPSED_KEY } from "@zoonk/ui/components/sidebar";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { stubTutorApi } from "../_test-utils/tutor-api";
import { buildTutor } from "../_test-utils/tutor-config";
import { buildLesson } from "../preview/preview-lesson";
import { contentStep, explanationStep, teachingStep } from "../preview/preview-steps";

function aside() {
  return page.getByRole("complementary", { name: "Help with this screen" });
}

function showsRecapRow(): boolean {
  return document.querySelector('[data-slot="lesson-recap-row"]')?.checkVisibility() ?? false;
}

function playQuestion() {
  const lesson = buildLesson([
    explanationStep(playableStepContent.explanation),
    contentStep("check", { content: playableStepContent.check }),
  ]);

  stubTutorApi({ lesson });
  renderLessonPlayer({ lesson, tutor: buildTutor() });
}

describe("collapsing the lesson's sidebar", () => {
  afterEach(() => {
    document.documentElement.removeAttribute(ASIDE_COLLAPSED_ATTRIBUTE);
    localStorage.removeItem(ASIDE_COLLAPSED_KEY);
  });

  it("moves what it holds into the lesson and remembers the choice", async () => {
    playQuestion();
    await page.getByRole("button", { name: /^Next/u }).click();

    await expect.element(aside()).toBeVisible();
    await expect.element(aside().getByText("From the lesson")).toBeVisible();
    await expect.poll(showsRecapRow).toBe(false);
    expect(page.getByRole("button", { name: "Ask Pip" }).query()).toBeNull();

    await page.getByRole("button", { name: "Collapse sidebar" }).click();

    await expect.poll(() => aside().query()).toBeNull();
    await expect.poll(showsRecapRow).toBe(true);
    await expect.element(page.getByRole("button", { name: "Ask Pip" })).toBeVisible();
    expect(localStorage.getItem(ASIDE_COLLAPSED_KEY)).toBe("true");

    await page.getByRole("button", { name: "Ask Pip" }).click();
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Expand sidebar" }).click();

    await expect.element(aside()).toBeVisible();
    await expect.poll(showsRecapRow).toBe(false);
    expect(localStorage.getItem(ASIDE_COLLAPSED_KEY)).toBe("false");
  });

  it("offers the lesson map from the menu at the lesson's end while the sidebar is collapsed", async () => {
    renderLessonPlayer({
      lesson: buildLesson([teachingStep("check")], {
        summary: { ideas: [{ text: "Electrons live in clouds." }], shape: "hub" },
      }),
    });

    await page
      .getByRole("radio", { name: "Where the electron is most likely to be found" })
      .click();

    await page.getByRole("button", { name: /^Check/u }).click();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await page.getByRole("button", { name: "Screen options" }).click();
    await page.getByRole("menuitem", { name: "Lesson map" }).click();

    const map = page.getByRole("dialog", { name: "Lesson map" });
    await expect.element(map.getByText("Electrons live in clouds.")).toBeVisible();
  });
});
