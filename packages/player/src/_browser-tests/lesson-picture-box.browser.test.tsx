import {
  pictureCheckContent,
  playableStepContent,
} from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { page } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { heldPicture } from "../_test-utils/held-pictures";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import { contentStep, pictureCheckStep, teachingStep } from "../preview/preview-steps";

const PHONE = { height: 667, width: 375 };
const QUESTION = "Does the electron circle the nucleus the way Earth circles the Sun?";
const EXPLANATION = "A cloud, not a little ball";
const PICTURE_POLL_MS = 4000;
const SCENE = 1.5;
const SQUARE = 1;

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

function boxOf(element: Element) {
  const { height, top, width } = element.getBoundingClientRect();
  return { height, top, width };
}

function expectRatio(box: { height: number; width: number }, ratio: number) {
  expect(box.height).toBeGreaterThan(0);
  expect(box.width / box.height).toBeCloseTo(ratio, 2);
}

function pollPictures() {
  vi.useFakeTimers({ shouldAdvanceTime: true });

  onTestFinished(() => {
    vi.useRealTimers();
  });

  return vi.fn<NonNullable<LessonPlayerAdapters["getLessonPictures"]>>().mockResolvedValue([]);
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
  ratio,
}: {
  alt: string;
  answer: () => Promise<void>;
  ratio: number;
}) {
  const before = boxOf(imageOf(alt));

  expect(loaded(alt)).toBe(false);
  expectRatio(before, ratio);

  await answer();
  await expect.poll(() => loaded(alt)).toBe(true);

  expect(boxOf(imageOf(alt))).toStrictEqual(before);
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
      await expectSameBoxOnceLoaded({ alt: hookAlt, answer: hook.answer, ratio: SCENE });
      expect(topOf(QUESTION)).toBe(questionTop);

      await page.getByRole("button", { exact: true, name: "I don't know yet" }).click();
      await page.getByRole("button", { name: /^Continue/u }).click();

      await expect.element(page.getByText(EXPLANATION)).toBeVisible();
      const explanationTop = topOf(EXPLANATION);
      await expectSameBoxOnceLoaded({ alt: stepAlt, answer: step.answer, ratio: SCENE });
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
        ratio: SQUARE,
      });
    });
  });

  it("keeps a scene's box when its picture finishes drawing", async () => {
    await atViewport(PHONE, async () => {
      const getLessonPictures = pollPictures();
      const held = await heldPicture();
      const alt = "A planet circling a sun";
      const hook = teachingStep("hook", { imagePending: true });
      const step = { ...hook, content: { ...hook.content, image: { alt, prompt: alt } } };
      const lesson = buildLesson([step]);

      renderLessonPlayer({ adapters: buildAdapters(lesson, { getLessonPictures }), lesson });

      await expect.element(page.getByText("Drawing the picture…")).toBeVisible();
      const drawing = boxOf(document.querySelector('[data-slot="media-pending"]') ?? document.body);
      const questionTop = topOf(QUESTION);
      expectRatio(drawing, SCENE);

      getLessonPictures.mockResolvedValue([
        { image: picture({ alt, shape: "scene", url: held.url }), stepId: step.id },
      ]);

      await vi.advanceTimersByTimeAsync(PICTURE_POLL_MS);
      await expect.poll(() => document.querySelector(`img[alt="${alt}"]`)).not.toBeNull();

      expect(boxOf(imageOf(alt))).toStrictEqual(drawing);
      expect(topOf(QUESTION)).toBe(questionTop);
    });
  });

  it("keeps a check's answer and its setup in place when an optional picture arrives", async () => {
    await atViewport(PHONE, async () => {
      const getLessonPictures = pollPictures();
      const held = await heldPicture();
      const alt = "Two atoms sharing a pair of electrons";

      const step = contentStep("check", {
        content: { ...playableStepContent.check, image: { alt, prompt: alt } },
        imagePending: true,
      });

      const lesson = buildLesson([step]);

      renderLessonPlayer({ adapters: buildAdapters(lesson, { getLessonPictures }), lesson });

      await expect.element(page.getByText("Drawing the picture…")).toBeVisible();
      const drawing = boxOf(document.querySelector('[data-slot="media-pending"]') ?? document.body);
      const questionTop = topOf(step.content.question);
      const option = page.getByRole("radio", { name: step.content.options[0]?.text });
      await option.click();
      await expect.element(option).toBeChecked();

      getLessonPictures.mockResolvedValue([
        { image: picture({ alt, shape: "scene", url: held.url }), stepId: step.id },
      ]);

      await vi.advanceTimersByTimeAsync(PICTURE_POLL_MS);
      await expect.poll(() => document.querySelector(`img[alt="${alt}"]`)).not.toBeNull();

      expect(boxOf(imageOf(alt))).toStrictEqual(drawing);
      expect(topOf(step.content.question)).toBe(questionTop);
      await expect.element(option).toBeChecked();
      await page.getByRole("button", { name: /^Check/u }).click();
      await expect.element(page.getByRole("button", { name: /^Continue/u })).toBeVisible();
    });
  });

  it("keeps an option picture's box when it finishes drawing", async () => {
    await atViewport(PHONE, async () => {
      const getLessonPictures = pollPictures();
      const held = await heldPicture();
      const step = pictureCheckStep({ drawn: ["gothic", "romanesque"], imagePending: true });
      const lesson = buildLesson([step]);
      const baroque = pictureCheckContent.options.find((option) => option.id === "baroque");
      const alt = baroque?.picture.alt ?? "";

      renderLessonPlayer({ adapters: buildAdapters(lesson, { getLessonPictures }), lesson });

      const option = page.getByRole("radio", { name: new RegExp(alt, "u") });
      await expect.element(option).toBeVisible();
      const status = option.element().querySelector('[role="status"]');
      const drawing = boxOf(status?.parentElement?.parentElement ?? document.body);
      expectRatio(drawing, SQUARE);

      getLessonPictures.mockResolvedValue([
        {
          image: picture({ alt, shape: "option", url: held.url }),
          optionId: "baroque",
          stepId: step.id,
        },
      ]);

      await vi.advanceTimersByTimeAsync(PICTURE_POLL_MS);
      await expect.poll(() => document.querySelector(`img[alt="${alt}"]`)).not.toBeNull();

      expect(boxOf(imageOf(alt))).toStrictEqual(drawing);
    });
  });
});
