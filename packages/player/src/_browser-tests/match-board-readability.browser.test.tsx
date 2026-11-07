import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";
import { openActivity } from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { languageStep } from "../preview/preview-steps";

const LESSON_PAIRS = [
  { left: "expedientes", right: "embarrassed" },
  { left: "landlord", right: "proprietário" },
  { left: "rent", right: "contas de água, luz e gás" },
];

function enlargeText(fontSize: string) {
  document.documentElement.style.fontSize = fontSize;

  onTestFinished(() => {
    document.documentElement.style.removeProperty("font-size");
  });
}

function wordsOf(card: Element) {
  const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest("[aria-hidden=true], .sr-only")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });

  const words: { lines: DOMRect[]; node: Text; word: string }[] = [];

  for (let node = walker.nextNode(); node instanceof Text; node = walker.nextNode()) {
    for (const match of node.data.matchAll(/\S+/gu)) {
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      words.push({ lines: [...range.getClientRects()], node, word: match[0] });
    }
  }

  return words;
}

function wholeWidth(node: Text, word: string) {
  const measure = document.createElement("span");
  measure.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
  measure.textContent = word;
  node.parentElement?.append(measure);
  const { width } = measure.getBoundingClientRect();
  measure.remove();

  return width;
}

function overlaps(line: DOMRect, mark: DOMRect) {
  return (
    line.left < mark.right &&
    line.right > mark.left &&
    line.top < mark.bottom &&
    line.bottom > mark.top
  );
}

/**
 * A word is unreadable when it runs out of its card or under its mark, or when it splits though a
 * card as wide as the board would have room for it whole.
 */
function unreadableWords(cards: readonly Element[]) {
  return cards.flatMap((card) => {
    const box = card.getBoundingClientRect();
    const board = card.closest("[class~='@container']")?.getBoundingClientRect().width ?? 0;
    const right = box.right - Number(getComputedStyle(card).paddingRight.replace("px", ""));

    const marks = [...card.querySelectorAll("[aria-hidden=true]")].map((mark) =>
      mark.getBoundingClientRect(),
    );

    return wordsOf(card)
      .filter(({ lines, node, word }) => {
        const textRoom =
          ([...card.children].find((child) => child.contains(node))?.getBoundingClientRect()
            .width ?? 0) +
          board -
          box.width;

        const isSplit = new Set(lines.map((line) => Math.round(line.top))).size > 1;
        const fitsWhole = wholeWidth(node, word) <= textRoom + 0.5;

        return (
          (isSplit && fitsWhole) ||
          lines.some(
            (line) => line.right > right + 0.5 || marks.some((mark) => overlaps(line, mark)),
          )
        );
      })
      .map(({ word }) => word);
  });
}

function cardsOutsideTheBoard(cards: readonly Element[]) {
  return cards.filter((card) => {
    const board = card.closest("[class~='@container']")?.getBoundingClientRect();
    const box = card.getBoundingClientRect();

    return !board || box.left < board.left - 0.5 || box.right > board.right + 0.5;
  });
}

function columnCount(cards: readonly Element[]) {
  return new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left))).size;
}

async function openMatchPairs({ longWord }: { longWord?: string } = {}) {
  const fixture = activityContentFixtures.matchPairs;
  const { distractors } = fixture.fields;

  openActivity({
    content: longWord
      ? {
          ...fixture,
          fields: {
            ...fixture.fields,
            distractors: [
              ...distractors,
              { side: "right", text: longWord, why: "It has no match." },
            ],
          },
        }
      : fixture,
    template: "matchPairs",
  });

  await page.getByRole("button", { exact: true, name: "embarazada" }).click();
  await page.getByRole("button", { exact: true, name: "pregnant" }).click();
  await expect.element(page.getByRole("button", { name: "pregnant, matched" })).toBeVisible();

  return page.getByRole("group", { name: "Cards to match" }).getByRole("button").elements();
}

describe("match boards at large text", () => {
  it.each([
    { columns: 1, fontSize: "100%", width: 320 },
    { columns: 2, fontSize: "100%", width: 360 },
    { columns: 1, fontSize: "150%", width: 375 },
    { columns: 1, fontSize: "150%", width: 480 },
    { columns: 1, fontSize: "200%", width: 390 },
    { columns: 1, fontSize: "200%", width: 640 },
  ])(
    "match pairs: $columns column(s) of whole words at $fontSize on a $width px screen",
    async ({ columns, fontSize, width }) => {
      enlargeText(fontSize);

      await atViewport({ height: 844, width }, async () => {
        const cards = await openMatchPairs();

        expect(unreadableWords(cards)).toStrictEqual([]);
        expect(cardsOutsideTheBoard(cards)).toStrictEqual([]);
        expect(columnCount(cards)).toBe(columns);
      });
    },
  );

  it("match pairs: a word wider than any card breaks inside its card", async () => {
    enlargeText("200%");

    await atViewport({ height: 844, width: 320 }, async () => {
      const cards = await openMatchPairs({ longWord: "electroencephalography" });

      expect(unreadableWords(cards)).toStrictEqual([]);
      expect(cardsOutsideTheBoard(cards)).toStrictEqual([]);
    });
  });

  it.each([
    { columns: 1, fontSize: "100%", width: 320 },
    { columns: 2, fontSize: "100%", width: 360 },
    { columns: 1, fontSize: "125%", width: 414 },
    { columns: 1, fontSize: "150%", width: 480 },
    { columns: 1, fontSize: "200%", width: 640 },
  ])(
    "lesson match step: $columns column(s) of whole words at $fontSize on a $width px screen",
    async ({ columns, fontSize, width }) => {
      enlargeText(fontSize);

      await atViewport({ height: 844, width }, async () => {
        renderLessonPlayer({
          lesson: buildLesson([languageStep("matchColumns", { pairs: LESSON_PAIRS })]),
        });

        await expect.element(page.getByRole("button", { name: "expedientes" })).toBeVisible();

        const items = LESSON_PAIRS.flatMap(({ left, right }) => [left, right]).map((word) =>
          page.getByRole("button", { exact: true, name: word }).element(),
        );

        expect(unreadableWords(items)).toStrictEqual([]);
        expect(cardsOutsideTheBoard(items)).toStrictEqual([]);
        expect(columnCount(items)).toBe(columns);
      });
    },
  );
});
