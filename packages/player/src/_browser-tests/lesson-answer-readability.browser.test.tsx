import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { contentStep } from "../preview/preview-steps";

const ANSWER = "Compartilhado entre os dois átomos, no par de elétrons";

function lessonWithAnswer(text: string) {
  return buildLesson(
    [
      contentStep("check", {
        content: {
          basis: null,
          options: [
            { id: "shared", isCorrect: true, reason: "Os átomos compartilham o par.", text },
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
  );
}

describe("checked answer readability", () => {
  it.each([
    { fontFamily: "", fontSize: "150%", width: 390 },
    { fontFamily: "", fontSize: "200%", width: 390 },
    { fontFamily: "", fontSize: "200%", width: 360 },
    { fontFamily: "", fontSize: "400%", width: 320 },
    { fontFamily: "monospace", fontSize: "200%", width: 400 },
  ])(
    "keeps the answer and tag readable at $fontSize on a $width px phone",
    async ({ fontFamily: enlargedFontFamily, fontSize: enlargedFontSize, width }) => {
      await atViewport({ height: 844, width }, async () => {
        const fontSize = document.documentElement.style.fontSize;
        const fontFamily = document.documentElement.style.fontFamily;

        try {
          renderLessonPlayer({ lesson: lessonWithAnswer(ANSWER) });

          const selected = page.getByRole("radio", { name: ANSWER });
          await selected.click();
          await page.getByRole("button", { name: /^Check/u }).click();
          await expect.element(selected.getByText("Your answer")).toBeVisible();

          document.documentElement.style.fontSize = enlargedFontSize;
          document.documentElement.style.fontFamily = enlargedFontFamily;

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
          const text = document.createTreeWalker(answer, NodeFilter.SHOW_TEXT).nextNode();
          const option = selected.element();
          const optionStyle = getComputedStyle(option);

          if (!text) {
            throw new Error("The selected answer must contain text.");
          }

          const measure = document.createElement("span");

          const availableWidth =
            option.clientWidth -
            Number(optionStyle.paddingLeft.replace("px", "")) -
            Number(optionStyle.paddingRight.replace("px", ""));

          measure.style.cssText =
            "position:fixed;visibility:hidden;white-space:nowrap;width:max-content";

          option.append(measure);

          for (const word of ANSWER.matchAll(/\S+/gu)) {
            measure.textContent = word[0];
            range.setStart(text, word.index);
            range.setEnd(text, word.index + word[0].length);
            const lines = new Set([...range.getClientRects()].map((line) => line.top));

            if (measure.getBoundingClientRect().width <= availableWidth && lines.size > 1) {
              splitWords.push(word[0]);
            }
          }

          measure.remove();
          expect(splitWords).toStrictEqual([]);

          expect(option.scrollWidth).toBeLessThanOrEqual(option.clientWidth);
        } finally {
          document.documentElement.style.fontSize = fontSize;
          document.documentElement.style.fontFamily = fontFamily;
        }
      });
    },
  );

  it.each([
    {
      fontSize: "150%",
      name: "short words",
      text: "Em apenas um dos dois átomos que formam a ligação",
      width: 350,
    },
    {
      fontSize: "200%",
      name: "Japanese",
      text: "共有された電子対は二つの原子の間にあります",
      width: 390,
    },
  ])(
    "does not squeeze $name when feedback appears with enlarged text",
    async ({ fontSize: enlargedFontSize, text, width }) => {
      await atViewport({ height: 844, width }, async () => {
        const fontSize = document.documentElement.style.fontSize;

        try {
          document.documentElement.style.fontSize = enlargedFontSize;
          renderLessonPlayer({ lesson: lessonWithAnswer(text) });

          const selected = page.getByRole("radio", { name: text });
          const answer = selected.getByText(text, { exact: true });
          await selected.click();
          const beforeLines = answer.element().getClientRects().length;

          await page.getByRole("button", { name: /^Check/u }).click();
          await expect.element(selected.getByText("Your answer")).toBeVisible();

          expect(answer.element().getClientRects()).toHaveLength(beforeLines);
        } finally {
          document.documentElement.style.fontSize = fontSize;
        }
      });
    },
  );
});
