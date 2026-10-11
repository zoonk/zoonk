import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { numberedCheckContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { expectAccessibleScreen } from "../_test-utils/accessibility";
import { press } from "../_test-utils/activity-player";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import {
  contentStep,
  explanationStep,
  inlineImage,
  numberedCheckStep,
} from "../preview/preview-steps";

/**
 * A question about where a part sits in one whole: its picture has a number drawn on each part, and
 * the answer key comes from those numbers. Without the picture nobody can tell which number is
 * which, so a screen whose numbered picture never came is left out, and an explanation shows its
 * words without the diagram's key.
 */

const heart = activityContentFixtures.labeledDiagram;
const OVARY = numberedCheckContent.options.find((option) => option.isCorrect);
const NEXT = { text: "Seeds grow inside the ovary.", title: "Inside the ovary" };

describe("numbered pictures", () => {
  it("asks which number marks a part, on the picture with the numbers", async () => {
    renderLessonPlayer({ lesson: buildLesson([numberedCheckStep()]) });

    await expect
      .element(page.getByRole("img", { name: numberedCheckContent.image.alt }))
      .toBeVisible();

    await expectAccessibleScreen("a numbered picture question");

    await page.getByRole("radio", { name: OVARY?.text }).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
  });

  it("leaves out numbered questions whose picture never came, and goes on", async () => {
    const diagram = contentStep("activity", { content: heart, imagePending: true });

    const lesson = buildLesson([
      diagram,
      numberedCheckStep({ drawn: false, imagePending: true }),
      explanationStep(NEXT),
    ]);

    renderLessonPlayer({ lesson });

    await expect.element(page.getByText(NEXT.text)).toBeVisible();
    await expect.element(page.getByText(numberedCheckContent.question)).not.toBeInTheDocument();

    // Nothing is left to go back to: neither question was played.
    await press("ArrowLeft");
    await expect.element(page.getByText(NEXT.text)).toBeVisible();
  });

  it("shows an explanation's words without the key of a diagram whose picture never came", async () => {
    const explore = { fields: heart.fields, template: "labeledDiagram" };
    const key = page.getByRole("list", { name: "What each number shows" });

    const drawn = explanationStep(
      { explore, text: "The heart has four chambers." },
      { image: inlineImage({ alt: heart.fields.picture.alt }) },
    );

    const lost = explanationStep({ explore, text: NEXT.text }, { imagePending: true });

    renderLessonPlayer({ lesson: buildLesson([drawn, lost]) });

    await expect.element(key).toBeVisible();

    await press("ArrowRight");
    await expect.element(page.getByText(NEXT.text)).toBeVisible();
    await expect.element(key).not.toBeInTheDocument();
  });
});
