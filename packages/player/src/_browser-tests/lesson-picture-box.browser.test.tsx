import { pictureCheckContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { heldPicture } from "../_test-utils/held-pictures";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { contentStep, teachingStep } from "../preview/preview-steps";

const PHONE = { height: 667, width: 375 };
const QUESTION = "Does the electron circle the nucleus the way Earth circles the Sun?";
const EXPLANATION = "A cloud, not a little ball";

function picture({ alt, shape, url }: { alt: string; shape: "option" | "scene"; url: string }) {
  const height = 1024;
  return { alt, height, id: crypto.randomUUID(), url, width: shape === "scene" ? 1536 : height };
}

function imageOf(alt: string): HTMLImageElement {
  const image = document.querySelector(`img[alt="${alt}"]`);

  if (!(image instanceof HTMLImageElement)) {
    throw new TypeError(`No picture "${alt}"`);
  }

  return image;
}

function boxOf(alt: string) {
  const { height, top, width } = imageOf(alt).getBoundingClientRect();
  return { height, top, width };
}

function loaded(alt: string): boolean {
  const image = imageOf(alt);
  return image.complete && image.naturalWidth > 0;
}

function topOf(text: string): number {
  return page.getByText(text).element().getBoundingClientRect().top;
}

async function expectSameBoxOnceLoaded({
  alt,
  answer,
}: {
  alt: string;
  answer: () => Promise<void>;
}) {
  const before = boxOf(alt);

  expect(loaded(alt)).toBe(false);
  expect(before.height).toBeGreaterThan(0);
  expect(before.width).toBeGreaterThan(0);

  await answer();
  await expect.poll(() => loaded(alt)).toBe(true);

  expect(boxOf(alt)).toStrictEqual(before);
}

describe("a drawn lesson picture", () => {
  it("holds its 3:2 box while its file loads, so the words under it never move", async () => {
    await atViewport(PHONE, async () => {
      const hook = await heldPicture();
      const step = await heldPicture();
      const hookAlt = "A planet circling a sun";
      const stepAlt = "A cloud around a nucleus";

      renderLessonPlayer({
        lesson: buildLesson([
          teachingStep("hook", { image: picture({ alt: hookAlt, shape: "scene", url: hook.url }) }),
          teachingStep("explanation", {
            image: picture({ alt: stepAlt, shape: "scene", url: step.url }),
          }),
        ]),
      });

      await expect.element(page.getByText(QUESTION)).toBeVisible();
      const questionTop = topOf(QUESTION);
      await expectSameBoxOnceLoaded({ alt: hookAlt, answer: hook.answer });
      expect(topOf(QUESTION)).toBe(questionTop);

      await page.getByRole("button", { exact: true, name: "I don't know yet" }).click();
      await page.getByRole("button", { name: /^Continue/u }).click();

      await expect.element(page.getByText(EXPLANATION)).toBeVisible();
      const explanationTop = topOf(EXPLANATION);
      await expectSameBoxOnceLoaded({ alt: stepAlt, answer: step.answer });
      expect(topOf(EXPLANATION)).toBe(explanationTop);
    });
  });

  it("holds an option picture's 1:1 box while its file loads", async () => {
    await atViewport(PHONE, async () => {
      const held = await Promise.all(pictureCheckContent.options.map(() => heldPicture()));

      const optionPictures = Object.fromEntries(
        pictureCheckContent.options.map((option, index) => [
          option.id,
          picture({ alt: option.picture.alt, shape: "option", url: held[index]?.url ?? "" }),
        ]),
      );

      renderLessonPlayer({
        lesson: buildLesson([
          contentStep("check", { content: pictureCheckContent, optionPictures }),
        ]),
      });

      const [first] = pictureCheckContent.options;
      const alt = first?.picture.alt ?? "";

      await expect.poll(() => document.querySelector(`img[alt="${alt}"]`)).not.toBeNull();

      await expectSameBoxOnceLoaded({
        alt,
        answer: async () => {
          await Promise.all(held.map((pending) => pending.answer()));
        },
      });
    });
  });
});
