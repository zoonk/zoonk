import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { contentStep } from "../preview/preview-steps";

const ANSWER = "Compartilhado entre os dois átomos, no par de elétrons";

describe("checked answer readability", () => {
  it.each([
    { fontSize: "150%", keepsWordsWhole: true, width: 390 },
    { fontSize: "200%", keepsWordsWhole: true, width: 390 },
    { fontSize: "400%", keepsWordsWhole: false, width: 320 },
  ])(
    "keeps the answer and tag readable at $fontSize on a $width px phone",
    async ({ fontSize: enlargedFontSize, keepsWordsWhole, width }) => {
      await atViewport({ height: 844, width }, async () => {
        const fontSize = document.documentElement.style.fontSize;

        try {
          renderLessonPlayer({
            lesson: buildLesson(
              [
                contentStep("check", {
                  content: {
                    basis: null,
                    options: [
                      {
                        id: "shared",
                        isCorrect: true,
                        reason: "Os átomos compartilham o par.",
                        text: ANSWER,
                      },
                      {
                        id: "single",
                        isCorrect: false,
                        reason: "O par é compartilhado.",
                        text: "Em apenas um dos átomos",
                      },
                    ],
                    question: "Onde está o par de elétrons compartilhado?",
                  },
                }),
              ],
              { language: "pt" },
            ),
          });

          const selected = page.getByRole("radio", { name: ANSWER });
          await selected.click();
          await page.getByRole("button", { name: /^Check/u }).click();
          await expect.element(selected.getByText("Your answer")).toBeVisible();

          document.documentElement.style.fontSize = enlargedFontSize;

          const answer = selected.getByText(ANSWER, { exact: true }).element();
          const tag = selected.getByText("Your answer").element().getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(answer);

          for (const line of range.getClientRects()) {
            const overlaps =
              line.left < tag.right &&
              line.right > tag.left &&
              line.top < tag.bottom &&
              line.bottom > tag.top;

            expect(overlaps).toBe(false);
          }

          const splitWords: string[] = [];

          if (keepsWordsWhole) {
            const text = document.createTreeWalker(answer, NodeFilter.SHOW_TEXT).nextNode();

            if (!text) {
              throw new Error("The selected answer must contain text.");
            }

            for (const word of ANSWER.matchAll(/\S+/gu)) {
              range.setStart(text, word.index);
              range.setEnd(text, word.index + word[0].length);
              const lines = new Set([...range.getClientRects()].map((line) => line.top));

              if (lines.size > 1) {
                splitWords.push(word[0]);
              }
            }
          }

          expect(splitWords).toStrictEqual([]);

          const option = selected.element();
          expect(option.scrollWidth).toBeLessThanOrEqual(option.clientWidth);
        } finally {
          document.documentElement.style.fontSize = fontSize;
        }
      });
    },
  );
});
