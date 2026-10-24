import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { contentStep, explanationStep, inlineImage } from "../preview/preview-steps";

/**
 * On a wide screen the lesson has the whole window: ✕ and "…" in its top corners, everything a
 * screen shows (a question's situation, a reading screen's picture) in the column with it, read in
 * the same order as on a phone, and only what helps with it ("From the lesson", the buddy) in the
 * aside beside it.
 */

const SITUATION = "In Mossoró, Priscila runs a public health unit and plans its night shifts.";
const PICTURE_ALT = "The brain from the side with its four lobes labeled";

function aside() {
  return page.getByRole("complementary", { name: "Help with this screen" });
}

function box(element: Element): DOMRect {
  return element.getBoundingClientRect();
}

function questionWithSituation() {
  return contentStep("check", { content: { ...playableStepContent.check, context: SITUATION } });
}

describe("lesson on a wide screen", () => {
  it("puts ✕ and the screen's menu in the window's top corners", async () => {
    renderLessonPlayer({ lesson: buildLesson([explanationStep(playableStepContent.explanation)]) });

    const close = page.getByRole("link", { name: "Close lesson" });
    const menu = page.getByRole("button", { name: "Screen options" });

    await expect.element(close).toBeVisible();
    await expect.element(menu).toBeVisible();

    expect(box(close.element()).left).toBeLessThan(32);
    expect(window.innerWidth - box(menu.element()).right).toBeLessThan(32);
  });

  it("keeps the menu above the aside when a long title wraps over several lines", async () => {
    await atViewport({ height: 768, width: 1024 }, async () => {
      const lesson = buildLesson([explanationStep(playableStepContent.explanation)]);

      renderLessonPlayer({
        lesson: {
          ...lesson,
          title:
            "A atuação da administração pública direta e indireta na organização dos serviços de saúde, da educação e da segurança, com os princípios que orientam cada uma delas",
        },
      });

      const title = page.getByRole("heading", { level: 1 });
      const menu = page.getByRole("button", { name: "Screen options" });

      await expect.element(menu).toBeVisible();
      expect(box(title.element()).height).toBeGreaterThan(50);
      expect(box(menu.element()).bottom).toBeLessThanOrEqual(box(aside().element()).top);
    });
  });

  it("keeps a question's situation right above it in the column, with the lesson beside it", async () => {
    const lesson = buildLesson([
      explanationStep(playableStepContent.explanation),
      questionWithSituation(),
    ]);

    renderLessonPlayer({ lesson });
    await page.getByRole("button", { name: /^Next/u }).click();

    const situation = page.getByText(SITUATION);
    const question = page.getByRole("heading", { name: playableStepContent.check.question });

    await expect.element(situation).toBeVisible();
    await expect.element(question).toBeVisible();

    const situationBox = box(situation.element());
    const questionBox = box(question.element());
    const asideBox = box(aside().element());

    expect(situationBox.right).toBeLessThanOrEqual(asideBox.left);
    expect(situationBox.left).toBeCloseTo(questionBox.left, 0);
    expect(situationBox.bottom).toBeLessThanOrEqual(questionBox.top);

    // The aside is free for what helps: the screen the question rests on.
    await expect.element(aside().getByText("From the lesson")).toBeVisible();
    await expect.element(aside().getByText("A cloud, not a little ball")).toBeVisible();
  });

  it("leads a reading screen with its picture in the column, and slides each new screen in", async () => {
    const lesson = buildLesson([
      explanationStep({ text: "The frontal lobe plans what you do.", title: "The frontal lobe" }),
      {
        ...explanationStep({
          image: { alt: PICTURE_ALT, prompt: PICTURE_ALT },
          text: "Your brain has four **lobes**. Each one does a different job.",
          title: "Four lobes",
        }),
        image: inlineImage({ alt: PICTURE_ALT }),
      },
    ]);

    renderLessonPlayer({ lesson });
    await page.getByRole("button", { name: /^Next/u }).click();

    const heading = page.getByRole("heading", { name: "Four lobes" });
    const picture = page.getByRole("img", { name: PICTURE_ALT });

    await expect.element(heading).toBeVisible();
    await expect.element(picture).toBeVisible();

    const screen = document.querySelector("[data-slot='lesson-screen']");
    expect(screen?.getAnimations().length).toBeGreaterThan(0);

    expect(box(picture.element()).right).toBeLessThanOrEqual(box(aside().element()).left);
    expect(box(picture.element()).bottom).toBeLessThanOrEqual(box(heading.element()).top);
  });
});
