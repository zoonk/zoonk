import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { press } from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { onDevice } from "../_test-utils/device-media";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { explanationStep, inlineImage, teachingStep } from "../preview/preview-steps";

/**
 * Lessons read like stories on every device: a new screen slides in from the side the learner
 * heads to (in place with reduced motion), and keyboards turn screens with the arrows as before.
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
    await atViewport(PHONE, async () => {
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
});
