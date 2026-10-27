import { tallyLessonRun } from "@zoonk/core/lesson-player/run";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson, localAdapters } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";

const RIGHT = "Where the electron is most likely to be found";
const WRONG = "The electron's exact path";

async function answer(option: string) {
  await page.getByRole("radio", { name: option }).click();
  await page.getByRole("button", { name: /^Check/u }).click();
  await page.getByRole("button", { name: /^Continue/u }).click();
}

describe("lesson score", () => {
  it.each([
    { isFirstCompletion: true, retryRight: false },
    { isFirstCompletion: true, retryRight: true },
    { isFirstCompletion: false, retryRight: false },
    { isFirstCompletion: false, retryRight: true },
  ])(
    "counts the bar's answers on first completion $isFirstCompletion with retry right $retryRight",
    async ({ isFirstCompletion, retryRight }) => {
      await atViewport({ height: 844, width: 390 }, async () => {
        const lesson = buildLesson([teachingStep("check")]);
        const local = localAdapters(lesson);
        const attempts: { isCorrect: boolean; stepId: string }[] = [];

        renderLessonPlayer({
          adapters: buildAdapters(lesson, {
            checkStep: async (input) => {
              const outcome = await local.checkStep(input);

              if (outcome.status === "checked") {
                attempts.push({ isCorrect: outcome.result.isCorrect, stepId: input.stepId });
              }

              return outcome;
            },
            completeLesson: async (input) => {
              const outcome = await local.completeLesson(input);
              const tally = tallyLessonRun({ attempts, steps: lesson.steps });

              // The real completion counts each question's first answer for rewards and reviews.
              expect(tally).toMatchObject({ correctCount: 0, incorrectCount: 1, isComplete: true });

              if (outcome.status !== "completed") {
                return outcome;
              }

              return {
                ...outcome,
                completion: {
                  ...outcome.completion,
                  correctCount: tally.correctCount,
                  incorrectCount: tally.incorrectCount,
                  isFirstCompletion,
                },
              };
            },
          }),
          lesson,
        });

        await answer(WRONG);
        await answer(retryRight ? RIGHT : WRONG);
        await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

        expect(
          [...document.querySelectorAll<HTMLElement>("[data-segment]")].map(
            (segment) => segment.dataset.segment,
          ),
        ).toStrictEqual(["wrong", retryRight ? "right" : "wrong"]);

        await expect
          .element(page.getByText(`${retryRight ? 1 : 0} of 2 right`, { exact: true }))
          .toBeVisible();
      });
    },
  );
});
