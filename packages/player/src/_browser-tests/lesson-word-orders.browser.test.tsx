import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { arrangeWordsStep } from "../lesson/_test-utils/lesson-steps";
import { buildLesson } from "../preview/preview-lesson";

describe("word-bank order grading", () => {
  it.each([
    {
      correctAnswer: "How much is the rent?",
      kind: "reading" as const,
      words: ["the", "rent?", "is", "How", "much"],
    },
    {
      correctAnswer: "Quanto é o aluguel?",
      kind: "listening" as const,
      words: ["o", "aluguel?", "é", "Quanto"],
    },
  ])(
    "checks a listed $kind order once the canonical number of tiles is placed",
    async ({ kind, words, correctAnswer }) => {
      const lesson = buildLesson([arrangeWordsStep(kind)], {
        language: "pt",
        targetLanguage: "en",
      });

      const adapters = buildAdapters(lesson);
      renderLessonPlayer({ adapters, lesson });
      const bank = page.getByRole("group", { name: "Word bank" });
      const check = page.getByRole("button", { name: /^Check/u });

      for (const word of words.slice(0, -1)) {
        // oxlint-disable-next-line no-await-in-loop -- The learner places the tiles one at a time.
        await bank.getByRole("button", { exact: true, name: word }).click();
      }

      await expect.element(check).toBeDisabled();
      await bank.getByRole("button", { exact: true, name: words.at(-1) }).click();
      await expect.element(check).toBeEnabled();
      await check.click();
      await expect.element(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
      await expect.poll(() => vi.mocked(adapters.checkStep).mock.calls.length).toBe(1);

      await expect(vi.mocked(adapters.checkStep).mock.results[0]?.value).resolves.toMatchObject({
        result: { correctAnswer, isCorrect: true },
        status: "checked",
      });
    },
  );
});
