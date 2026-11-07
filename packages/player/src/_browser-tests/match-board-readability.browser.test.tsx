import { describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";
import { openActivity } from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { languageStep } from "../preview/preview-steps";

const SETTINGS = [
  { columns: 2, fontSize: "100%", width: 360 },
  { columns: 1, fontSize: "150%", width: 375 },
  { columns: 1, fontSize: "200%", width: 390 },
];

function enlargeText(fontSize: string) {
  document.documentElement.style.fontSize = fontSize;

  onTestFinished(() => {
    document.documentElement.style.removeProperty("font-size");
  });
}

function wordBoxes(card: Element) {
  const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest("[aria-hidden=true], .sr-only")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });

  const words: { lines: DOMRect[]; word: string }[] = [];

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (const match of (node.textContent ?? "").matchAll(/\S+/gu)) {
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      words.push({ lines: [...range.getClientRects()], word: match[0] });
    }
  }

  return words;
}

function unreadableWords(cards: readonly Element[]) {
  return cards.flatMap((card) => {
    const box = card.getBoundingClientRect();
    const style = getComputedStyle(card);
    const right = box.right - Number(style.paddingRight.replace("px", ""));

    const marks = [...card.querySelectorAll("[aria-hidden=true]")].map((mark) =>
      mark.getBoundingClientRect(),
    );

    return wordBoxes(card)
      .filter(
        ({ lines }) =>
          new Set(lines.map((line) => Math.round(line.top))).size > 1 ||
          lines.some(
            (line) =>
              line.right > right + 0.5 ||
              marks.some(
                (mark) =>
                  line.left < mark.right &&
                  line.right > mark.left &&
                  line.top < mark.bottom &&
                  line.bottom > mark.top,
              ),
          ),
      )
      .map(({ word }) => word);
  });
}

function columnCount(cards: readonly Element[]) {
  return new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left))).size;
}

describe("match boards at large text", () => {
  it.each(SETTINGS)(
    "match pairs: $columns column(s) of whole words at $fontSize on a $width px phone",
    async ({ columns, fontSize, width }) => {
      enlargeText(fontSize);

      await atViewport({ height: 844, width }, async () => {
        openActivity({ template: "matchPairs" });
        await page.getByRole("button", { exact: true, name: "embarazada" }).click();
        await page.getByRole("button", { exact: true, name: "pregnant" }).click();

        const cards = page.getByRole("group", { name: "Cards to match" }).getByRole("button");
        await expect.element(page.getByRole("button", { name: "pregnant, matched" })).toBeVisible();

        expect(unreadableWords(cards.elements())).toStrictEqual([]);
        expect(columnCount(cards.elements())).toBe(columns);
      });
    },
  );

  it.each(SETTINGS)(
    "lesson match step: $columns column(s) of whole words at $fontSize on a $width px phone",
    async ({ columns, fontSize, width }) => {
      enlargeText(fontSize);

      const pairs = [
        { left: "expedientes", right: "embarrassed" },
        { left: "landlord", right: "proprietário" },
        { left: "rent", right: "contas de água, luz e gás" },
      ];

      await atViewport({ height: 844, width }, async () => {
        renderLessonPlayer({ lesson: buildLesson([languageStep("matchColumns", { pairs })]) });

        await expect.element(page.getByRole("button", { name: "expedientes" })).toBeVisible();

        const board = pairs
          .flatMap(({ left, right }) => [left, right])
          .map((word) => page.getByRole("button", { exact: true, name: word }).element());

        expect(unreadableWords(board)).toStrictEqual([]);
        expect(columnCount(board)).toBe(columns);
      });
    },
  );
});
