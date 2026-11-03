import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { heldPicture } from "../_test-utils/held-pictures";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";

const PHONE = { height: 667, width: 375 };
const QUESTION = "Does the electron circle the nucleus the way Earth circles the Sun?";
const EXPLANATION = "A cloud, not a little ball";

function picture(url: string, alt: string) {
  return { alt, height: 1024, id: crypto.randomUUID(), url, width: 1536 };
}

function topOf(text: string): number {
  return page.getByText(text).element().getBoundingClientRect().top;
}

function loaded(alt: string): boolean {
  const image = document.querySelector(`img[alt="${alt}"]`);
  return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
}

describe("a drawn lesson picture", () => {
  it("holds its box while its file loads, so the words under it never move", async () => {
    await atViewport(PHONE, async () => {
      const hookPicture = heldPicture(`hook-${crypto.randomUUID()}.png`);
      const stepPicture = heldPicture(`step-${crypto.randomUUID()}.png`);

      renderLessonPlayer({
        lesson: buildLesson([
          teachingStep("hook", { image: picture(hookPicture.url, "A planet circling a sun") }),
          teachingStep("explanation", {
            image: picture(stepPicture.url, "A cloud around a nucleus"),
          }),
        ]),
      });

      await expect.element(page.getByText(QUESTION)).toBeVisible();
      const questionTop = topOf(QUESTION);
      expect(loaded("A planet circling a sun")).toBe(false);

      await hookPicture.answer();
      await expect.poll(() => loaded("A planet circling a sun")).toBe(true);
      expect(topOf(QUESTION)).toBe(questionTop);

      await page.getByRole("button", { exact: true, name: "I don't know yet" }).click();
      await page.getByRole("button", { name: /^Continue/u }).click();

      await expect.element(page.getByText(EXPLANATION)).toBeVisible();
      const explanationTop = topOf(EXPLANATION);
      expect(loaded("A cloud around a nucleus")).toBe(false);

      await stepPicture.answer();
      await expect.poll(() => loaded("A cloud around a nucleus")).toBe(true);
      expect(topOf(EXPLANATION)).toBe(explanationTop);
    });
  });
});
