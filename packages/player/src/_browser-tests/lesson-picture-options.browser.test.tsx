import { pictureCheckContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { page } from "vitest/browser";
import { expectAccessibleScreen } from "../_test-utils/accessibility";
import { expectCount, press } from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import { contentStep, inlineImage, pictureCheckStep } from "../preview/preview-steps";

const [GOTHIC, ROMANESQUE, BAROQUE] = pictureCheckContent.options;
const PHONE = { height: 812, width: 375 };

const PICTURE_POLL_MS = 4000;

function option(alt: string) {
  return page.getByRole("radio", { name: new RegExp(alt, "u") });
}

async function checkAnswer(expected: "Correct!" | "Not quite") {
  await page.getByRole("button", { name: /^Check/u }).click();
  await expect.element(page.getByRole("status").filter({ hasText: expected })).toBeVisible();
}

describe("picture options", () => {
  it("picks a picture by what it looks like, and keeps only the named right one once checked", async () => {
    renderLessonPlayer({ lesson: buildLesson([pictureCheckStep()]) });

    await expect.element(page.getByRole("img", { name: GOTHIC?.picture.alt })).toBeVisible();
    await expect.element(page.getByText("Romanesque", { exact: true })).not.toBeInTheDocument();

    await option(GOTHIC?.picture.alt ?? "").click();
    await checkAnswer("Correct!");

    await expect.element(page.getByText("Gothic", { exact: true })).toBeVisible();
    await expectCount(page.getByRole("radio"), 1);
    await expect.element(page.getByText("Romanesque", { exact: true })).not.toBeInTheDocument();
    await expect.element(page.getByText("Baroque", { exact: true })).not.toBeInTheDocument();
  });

  it("picks with a number key, and marks a wrong pick next to the right one", async () => {
    renderLessonPlayer({ lesson: buildLesson([pictureCheckStep()]) });

    await expect.element(page.getByRole("img", { name: ROMANESQUE?.picture.alt })).toBeVisible();
    await press("2");

    await expect
      .element(option(ROMANESQUE?.picture.alt ?? ""))
      .toHaveAttribute("aria-checked", "true");

    await checkAnswer("Not quite");
    await expect.element(page.getByText(ROMANESQUE?.reason ?? "")).toBeVisible();
  });

  it("takes answers from picture descriptions while pictures are drawn", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    onTestFinished(() => {
      vi.useRealTimers();
    });

    const step = pictureCheckStep({ drawn: ["gothic", "romanesque"], imagePending: true });
    const lesson = buildLesson([step]);
    const drawn = inlineImage({ alt: BAROQUE?.picture.alt ?? "" });

    const getLessonPictures = vi
      .fn<NonNullable<LessonPlayerAdapters["getLessonPictures"]>>()
      .mockResolvedValue([]);

    renderLessonPlayer({ adapters: buildAdapters(lesson, { getLessonPictures }), lesson });

    await expect
      .element(page.getByRole("status").filter({ hasText: "Drawing the picture…" }))
      .toBeInTheDocument();

    await expect.element(page.getByText(BAROQUE?.picture.alt ?? "")).toBeVisible();
    await option(BAROQUE?.picture.alt ?? "").click();
    await checkAnswer("Not quite");
    expect(getLessonPictures).toHaveBeenLastCalledWith([step.id]);

    getLessonPictures.mockResolvedValue([{ image: drawn, optionId: "baroque", stepId: step.id }]);
    await vi.advanceTimersByTimeAsync(PICTURE_POLL_MS);

    await expect.element(page.getByRole("img", { name: BAROQUE?.picture.alt })).toBeVisible();
  });

  it("shows the drawing status and icon on a pending option", async () => {
    renderLessonPlayer({
      lesson: buildLesson([
        pictureCheckStep({ drawn: ["gothic", "romanesque"], imagePending: true }),
      ]),
    });

    const status = option(BAROQUE?.picture.alt ?? "").getByRole("status");
    await expect.element(status).toHaveTextContent("Drawing the picture…");
    const message = status.element();
    expect(message.getBoundingClientRect().width).toBeGreaterThan(1);
    const icon = message.closest("[data-slot='media-pending']")?.querySelector("svg");
    expect(icon?.getBoundingClientRect().width).toBeGreaterThan(0);
  });

  it("shows the full description of an option while its picture is drawing on a phone", async () => {
    const alt = "A red apple beside a sliced green pear and a bowl of plums on a wooden table";

    await atViewport(PHONE, async () => {
      const step = contentStep("check", {
        content: {
          ...pictureCheckContent,
          options: pictureCheckContent.options.map((choice) =>
            choice.id === "baroque" ? { ...choice, picture: { ...choice.picture, alt } } : choice,
          ),
        },
        imagePending: true,
        optionPictures: pictureCheckStep({ drawn: ["gothic", "romanesque"] }).optionPictures,
      });

      renderLessonPlayer({ lesson: buildLesson([step]) });

      const description = option(alt).getByText(alt, { exact: true });
      await expect.element(description).toBeVisible();
      const paragraph = description.element();
      const placeholder = paragraph.closest("[data-slot='media-pending']")!;
      expect(paragraph.scrollHeight).toBe(paragraph.clientHeight);

      expect(paragraph.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        placeholder.getBoundingClientRect().bottom,
      );

      expect(paragraph.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        placeholder.getBoundingClientRect().top,
      );
    });
  });

  it("describes a picture that never came, so the question still plays", async () => {
    renderLessonPlayer({
      lesson: buildLesson([pictureCheckStep({ drawn: ["gothic", "romanesque"] })]),
    });

    await expect.element(page.getByText(BAROQUE?.picture.alt ?? "")).toBeVisible();
    await option(BAROQUE?.picture.alt ?? "").click();
    await checkAnswer("Not quite");
  });

  it.each([
    { imagePending: false, state: "missing" },
    { imagePending: true, state: "drawing" },
  ])(
    "keeps a $state picture's long description clear of the pick mark on a phone",
    async ({ imagePending }) => {
      const alt =
        "A red apple beside a sliced green pear, a bowl of dark plums and a jug of milk on a long wooden table by a window";

      await atViewport(PHONE, async () => {
        const step = contentStep("check", {
          content: {
            ...pictureCheckContent,
            options: pictureCheckContent.options.map((choice) =>
              choice.id === "baroque" ? { ...choice, picture: { ...choice.picture, alt } } : choice,
            ),
          },
          imagePending,
          optionPictures: pictureCheckStep({ drawn: ["gothic", "romanesque"] }).optionPictures,
        });

        renderLessonPlayer({ lesson: buildLesson([step]) });

        const description = option(alt).getByText(alt, { exact: true });
        await expect.element(description).toBeVisible();
        const mark = option(alt).element().querySelector("[data-slot='answer-option-mark']")!;
        const markBox = mark.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(description.element());

        const overlapping = [...range.getClientRects()].filter(
          (line) =>
            line.right > markBox.left &&
            line.left < markBox.right &&
            line.bottom > markBox.top &&
            line.top < markBox.bottom,
        );

        expect(overlapping).toStrictEqual([]);
      });
    },
  );

  it("is accessible on a phone in light and dark", async () => {
    await atViewport(PHONE, async () => {
      renderLessonPlayer({ lesson: buildLesson([pictureCheckStep()]) });

      await expect.element(page.getByRole("img", { name: BAROQUE?.picture.alt })).toBeVisible();
      await expectAccessibleScreen("picture options");
    });
  });
});
