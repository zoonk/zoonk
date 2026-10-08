import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { inlineImage, press } from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { onDevice } from "../_test-utils/device-media";
import { explanationStep, teachingStep } from "../_test-utils/lesson-steps";
import { buildLesson, renderLessonPlayer } from "../_test-utils/render-lesson-player";

/**
 * Lessons read like stories on every device: a reading screen leads with its picture, a new screen
 * slides in from the side the learner heads to (in place with reduced motion), and keyboards turn
 * screens with the arrows as before. A question's picture leaves its options in reach.
 */

const PHONE = { height: 812, width: 375 };

const LOBES = {
  alt: "The brain from the side with its four lobes labeled",
  text: "Your brain has four **lobes**. Each one does a different job.",
  title: "Four lobes",
};

function pictured({ alt, text, title }: typeof LOBES) {
  return {
    ...explanationStep({ image: { alt, prompt: alt }, text, title }),
    image: inlineImage({ alt }),
  };
}

function pictureQuestion() {
  const base = teachingStep("check");
  const alt = "Two planets side by side, labeled 1 and 2";

  return {
    ...base,
    content: { ...base.content, image: { alt, prompt: alt } },
    image: inlineImage({ alt }),
  };
}

/** The screen in view, as the learner sees it move. */
function shownScreen(): Element {
  const screen = document.querySelector("[data-slot='lesson-screen']");

  if (!screen) {
    throw new Error("No lesson screen is showing.");
  }

  return screen;
}

describe("lessons that read like stories", () => {
  it("turns reading screens with the arrow keys, sliding each new one in", async () => {
    const lesson = buildLesson([
      pictured(LOBES),
      explanationStep({ text: "The frontal lobe plans what you do.", title: "The frontal lobe" }),
    ]);

    renderLessonPlayer({ lesson });

    await expect.element(page.getByRole("heading", { name: LOBES.title })).toBeVisible();
    expect(shownScreen().getAnimations()).toHaveLength(0);

    await press("ArrowRight");
    await expect.element(page.getByRole("heading", { name: "The frontal lobe" })).toBeVisible();
    expect(shownScreen().getAnimations().length).toBeGreaterThan(0);

    await press("ArrowLeft");
    await expect.element(page.getByRole("heading", { name: LOBES.title })).toBeVisible();
    expect(shownScreen().getAnimations().length).toBeGreaterThan(0);
  });

  it("shows a new screen in place when the device asks for reduced motion", async () => {
    await onDevice({ reducedMotion: "reduce" }, async () => {
      const lesson = buildLesson([pictured(LOBES), teachingStep("explanation")]);
      renderLessonPlayer({ lesson });

      await press("ArrowRight");

      await expect
        .element(page.getByRole("heading", { name: LOBES.title }))
        .not.toBeInTheDocument();

      expect(shownScreen().getAnimations()).toHaveLength(0);
    });
  });

  it("starts every screen at its top, even after the one before was read to its end", async () => {
    await atViewport(PHONE, async () => {
      const text = Array.from(
        { length: 14 },
        (_, index) => `Sentence ${index + 1} adds one more detail about the brain.`,
      ).join(" ");

      const long = pictured({
        alt: "The brain's two halves seen from above",
        text,
        title: "A long read",
      });

      // The next screen is long too, so a kept scroll position would hide its picture.
      const next = pictured({ ...LOBES, text: `${LOBES.text} ${text}`.slice(0, 1100) });
      renderLessonPlayer({ lesson: buildLesson([long, next]) });

      const scroller = page.getByRole("main", { name: "Lesson content" }).element();
      await expect.element(page.getByRole("heading", { name: "A long read" })).toBeVisible();

      // Read down to the end of the long screen, then turn it.
      scroller.scrollTo({ top: scroller.scrollHeight });
      await expect.poll(() => scroller.scrollTop).toBeGreaterThan(0);
      await press("ArrowRight");

      await expect.element(page.getByRole("img", { name: LOBES.alt })).toBeInViewport();
      expect(scroller.scrollTop).toBe(0);
    });
  });

  it("leads a reading screen with its picture across a phone, and keeps a question's options in reach", async () => {
    await atViewport(PHONE, async () => {
      const lesson = buildLesson([pictured(LOBES), pictureQuestion()]);
      renderLessonPlayer({ lesson });

      const picture = page.getByRole("img", { name: LOBES.alt });
      await expect.element(picture).toBeVisible();

      const pictureBox = picture.element().getBoundingClientRect();

      const titleBox = page
        .getByRole("heading", { name: LOBES.title })
        .element()
        .getBoundingClientRect();

      expect(pictureBox.bottom).toBeLessThanOrEqual(titleBox.top);
      expect(pictureBox.width).toBeGreaterThan(PHONE.width * 0.9);
      await expect.element(page.getByRole("heading", { name: LOBES.title })).toBeInViewport();

      await press("ArrowRight");
      await expect.element(page.getByRole("img", { name: /Two planets/u })).toBeVisible();
      await expect.element(page.getByRole("radio").first()).toBeInViewport();
    });
  });
});
