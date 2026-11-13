import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  type PageWords,
  countWords,
  pageKind,
  placeFindings,
  summarizeWords,
  titleGapFindings,
  wordFindings,
  wordGrowth,
} from "./words.mts";

const MARKED_WORDS = 5;
const GROWTH_PERCENT = 22;

function page(overrides: Partial<PageWords> = {}): PageWords {
  return {
    aboveAction: 2,
    action: "Start",
    actionPinned: null,
    kind: "app",
    longestButton: "Start",
    titleGap: null,
    words: 40,
    ...overrides,
  };
}

function checks(words: PageWords) {
  return wordFindings(words).map((finding) => finding.check);
}

describe("counting a page's words", () => {
  it("counts words with a letter or digit, in any script, and not the marks between them", () => {
    assert.equal(countWords("Today · 3 lessons → 12 min"), MARKED_WORDS);
    assert.equal(countWords("  Olá, mundo!\n今日 "), 3);
    assert.equal(countWords(""), 0);
  });

  it("keeps the button label with the most words", () => {
    const words = summarizeWords(
      {
        aboveAction: 1,
        action: "Continue",
        actionPinned: true,
        buttons: ["Continue", "Continue to daily time", "Skip"],
        text: "Pick a time",
        titleGap: 16,
      },
      "app",
    );

    assert.equal(words.longestButton, "Continue to daily time");
    assert.equal(words.words, 3);
  });

  it("tells the product's own screens from long-form and marketing pages", () => {
    assert.deepEqual(
      [
        "/learn/abc",
        "/pt/privacy",
        "/b/zoonk/c/math/ch/algebra/l/what-is-x",
        "/",
        "/pt",
        "/b/zoonk/c/math",
        "/courses/math",
        "/pricing/brl",
        "/plan-link/abc",
        "/c/ABC123",
        "/blog",
        "/today",
        "/learning",
        "/plan",
      ].map((path) => pageKind("main", path)),
      [
        ...Array.from({ length: 3 }, () => "long-form"),
        ...Array.from({ length: 8 }, () => "marketing"),
        ...Array.from({ length: 3 }, () => "app"),
      ],
    );

    assert.equal(pageKind("blog", "/some-post"), "marketing");
  });
});

describe("judging a page's words", () => {
  it("leads to a page over the budget and stays quiet within it", () => {
    assert.deepEqual(checks(page()), []);

    assert.deepEqual(
      checks(page({ aboveAction: 5, longestButton: "Continue to daily time", words: 61 })),
      ["text before the action", "words", "button label"],
    );
  });

  it("leaves words alone on a page that asks nothing, on long-form and on marketing pages", () => {
    const over = { aboveAction: 9, longestButton: "Start your free plan today", words: 900 };
    assert.deepEqual(checks(page({ aboveAction: null, action: null, words: 300 })), []);
    assert.deepEqual(checks(page({ ...over, kind: "long-form" })), ["button label"]);
    assert.deepEqual(checks(page({ ...over, kind: "marketing" })), []);
    assert.deepEqual(wordGrowth(page({ words: 50 }), page({ kind: "marketing", words: 90 })), []);
  });

  it("marks words that grew past a fifth since the baseline", () => {
    assert.deepEqual(wordGrowth(page({ words: 50 }), page({ words: 60 })), []);
    assert.equal(wordGrowth(page({ words: 50 }), page({ words: 61 }))[0]?.value, GROWTH_PERCENT);
    assert.deepEqual(wordGrowth(undefined, page({ words: 61 })), []);
  });
});

describe("where the title and the main action sit (the founder's rules 3 and 4)", () => {
  it("leads to an app screen's one main action that isn't pinned", () => {
    assert.deepEqual(
      [
        page({ actionPinned: false }),
        page({ actionPinned: true }),
        page({ actionPinned: null }),
        page({ actionPinned: false, kind: "marketing" }),
      ].map((each) => placeFindings(each).length),
      [1, 0, 0, 0],
    );
  });

  it("leads to a title with more room above it on one screen than the other", () => {
    const [finding] = titleGapFindings(page({ titleGap: 40 }), page({ titleGap: 16 }));
    assert.equal(finding?.value, 24);
    assert.deepEqual(titleGapFindings(page({ titleGap: 18 }), page({ titleGap: 16 })), []);
    assert.deepEqual(titleGapFindings(page({ titleGap: null }), page({ titleGap: 16 })), []);
  });
});
