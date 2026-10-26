import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildTutor } from "../_test-utils/tutor-config";
import { buildLesson } from "../preview/preview-lesson";
import { contentStep, explanationStep, inlineImage, teachingStep } from "../preview/preview-steps";

/**
 * On a wide screen the lesson has the whole window: ✕ and "…" in the top corners of its room,
 * everything a screen shows (a question's situation, a reading screen's picture) in the column
 * with it, read in the same order as on a phone, and only what helps with it ("From the lesson",
 * the buddy) in the aside, a rail at the window's right edge behind a hairline, with the column
 * centered in the room on its left.
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

/** The task's column, as the progress under the title spans it. */
function column(): DOMRect {
  const segments = document.querySelector('[data-slot="task-header-segments"]');

  if (!segments) {
    throw new Error("The lesson's progress isn't drawn");
  }

  return box(segments);
}

/** Where the words of an element start, wherever its border and padding put them. */
function textLeft(element: Element): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect().left;
}

describe("lesson on a wide screen", () => {
  it("puts ✕ in the window's top-left corner and the screen's menu beside the aside", async () => {
    renderLessonPlayer({ lesson: buildLesson([explanationStep(playableStepContent.explanation)]) });

    const close = page.getByRole("link", { name: "Close lesson" });
    const menu = page.getByRole("button", { name: "Screen options" });

    await expect.element(close).toBeVisible();
    await expect.element(menu).toBeVisible();

    const gap = box(aside().element()).left - box(menu.element()).right;

    expect(box(close.element()).left).toBeLessThan(32);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(32);
  });

  it("keeps the menu clear of the aside when a long title wraps over several lines", async () => {
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
      // Wrapped: more than its one 20px line.
      expect(box(title.element()).height).toBeGreaterThan(20);
      expect(box(title.element()).right).toBeLessThanOrEqual(box(menu.element()).left);
      expect(box(menu.element()).right).toBeLessThanOrEqual(box(aside().element()).left);
    });
  });

  it("keeps the aside at the window's right edge and the column centered on its left, however wide the window", async () => {
    const sizes = [
      { aside: 300, height: 768, width: 1024 },
      { aside: 320, height: 1080, width: 1920 },
      { aside: 320, height: 1440, width: 2560 },
    ];

    for (const { aside: width, ...size } of sizes) {
      // oxlint-disable-next-line no-await-in-loop -- Each size plays after the one before.
      await atViewport(size, async () => {
        const view = renderLessonPlayer({
          lesson: buildLesson([
            explanationStep(playableStepContent.explanation),
            questionWithSituation(),
          ]),
        });

        await page.getByRole("button", { name: /^Next/u }).click();
        await expect.element(aside().getByText("From the lesson")).toBeVisible();

        const asideBox = box(aside().element());
        const { left, right } = column();

        expect(asideBox.width).toBe(width);
        expect(asideBox.right).toBe(window.innerWidth);
        expect(asideBox.top).toBe(0);
        expect(asideBox.bottom).toBe(window.innerHeight);
        expect(right - left).toBe(640);
        expect(Math.abs(left - (asideBox.left - right))).toBeLessThanOrEqual(1);
        view.unmount();
      });
    }
  });

  it("draws the aside behind one hairline, never a panel, so one with only the buddy is the page's edge", async () => {
    renderLessonPlayer({ lesson: buildLesson([teachingStep("explanation")]), tutor: buildTutor() });

    const style = getComputedStyle(aside().element());

    await expect.element(aside()).toBeVisible();
    expect(style.borderLeftWidth).toBe("1px");
    expect(style.borderTopWidth).toBe("0px");
    expect(style.backgroundColor).toBe(getComputedStyle(document.body).backgroundColor);
  });

  it("runs the action bar's hairline up to the aside, the buddy's composer level with it", async () => {
    renderLessonPlayer({ lesson: buildLesson([teachingStep("check")]), tutor: buildTutor() });

    const field = aside().getByRole("textbox", { name: "Ask Pip about this screen" });
    const check = page.getByRole("button", { name: /^Check/u });

    await expect.element(field).toBeVisible();

    const bar = document.querySelector('[data-slot="lesson-action-bar"]');
    const frame = field.element().closest('[data-slot="input-group"]');

    expect(box(bar ?? document.body).right).toBe(box(aside().element()).left);
    expect(box(frame ?? document.body).top).toBeCloseTo(box(check.element()).top, 0);
    expect(box(frame ?? document.body).bottom).toBeCloseTo(box(check.element()).bottom, 0);
  });

  it("puts Back and the main action in the action bar's corners, not at the column's edges", async () => {
    renderLessonPlayer({
      lesson: buildLesson([
        explanationStep(playableStepContent.explanation),
        teachingStep("check"),
      ]),
    });

    await page.getByRole("button", { name: /^Next/u }).click();

    const back = page.getByRole("button", { name: "Previous screen" });
    const check = page.getByRole("button", { name: /^Check/u });

    await expect.element(back).toBeVisible();

    const backBox = box(back.element());
    const checkBox = box(check.element());
    const rightGap = box(aside().element()).left - checkBox.right;

    expect(backBox.left).toBeLessThan(column().left);
    expect(checkBox.right).toBeGreaterThan(column().right);
    expect(Math.abs(backBox.left - rightGap)).toBeLessThanOrEqual(1);
  });

  it("keeps a quiet action's label on the column's text edge", async () => {
    renderLessonPlayer({ lesson: buildLesson([teachingStep("typedAnswer")]) });

    const question = page.getByRole("heading", { name: playableStepContent.typedAnswer.question });
    const dontKnow = page.getByRole("button", { name: "I don't know yet" });

    await expect.element(dontKnow).toBeVisible();
    expect(textLeft(dontKnow.element())).toBeCloseTo(textLeft(question.element()), 0);
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
