import { describe, expect, it } from "vitest";
import { type RawWarmUpCard, toWarmUpCards } from "./warm-up-cards";

function rawCard(overrides: Partial<RawWarmUpCard> = {}): RawWarmUpCard {
  return {
    options: [
      { correct: true, text: "Five" },
      { correct: false, text: "Two" },
      { correct: false, text: "Eight" },
    ],
    question: "How many eyes does a honey bee have?",
    reveal: "Five: two big compound eyes and three small simple eyes on top.",
    ...overrides,
  };
}

function optionTexts(cards: ReturnType<typeof toWarmUpCards>) {
  return cards.map((card) => card.options.map((option) => option.text));
}

describe(toWarmUpCards, () => {
  it("keeps a clean card with ids by position and option ids in display order", () => {
    const [card] = toWarmUpCards([rawCard()]);

    expect(card?.id).toBe("1");
    expect(card?.question).toBe("How many eyes does a honey bee have?");
    expect(card?.options.map((option) => option.id)).toStrictEqual(["a", "b", "c"]);

    expect(
      card?.options
        .map(({ correct, text }) => ({ correct, text }))
        .toSorted((first, second) => first.text.localeCompare(second.text)),
    ).toStrictEqual([
      { correct: false, text: "Eight" },
      { correct: true, text: "Five" },
      { correct: false, text: "Two" },
    ]);
  });

  it("replaces em dashes, strips Markdown and collapses spaces", () => {
    const [card] = toWarmUpCards([
      rawCard({
        options: [
          { correct: true, text: "**Mite**" },
          { correct: false, text: "Wasp  " },
        ],
        question: "Varroa,  a pest every beekeeper checks for, is a kind of…",
        reveal: "A mite — it feeds on bees\nand spreads viruses.",
      }),
    ]);

    expect(card?.question).toBe("Varroa, a pest every beekeeper checks for, is a kind of…");
    expect(card?.reveal).toBe("A mite, it feeds on bees and spreads viruses.");
    expect(card?.options.map((option) => option.text).toSorted()).toStrictEqual(["Mite", "Wasp"]);
  });

  it("unwraps links and code spans but keeps code that looks like Markdown", () => {
    const [card] = toWarmUpCards([
      rawCard({
        options: [
          { correct: true, text: "**" },
          { correct: false, text: "^" },
          { correct: false, text: "*" },
        ],
        question: "In Python, which operator makes `2 ** 3` equal 8, as in __init__ code?",
        reveal:
          "The ** operator raises to a power, as the [Python docs](https://docs.python.org) say.",
      }),
    ]);

    expect(card?.question).toBe(
      "In Python, which operator makes 2 ** 3 equal 8, as in __init__ code?",
    );

    expect(card?.reveal).toBe("The ** operator raises to a power, as the Python docs say.");
    expect(card?.options.map((option) => option.text).toSorted()).toStrictEqual(["*", "**", "^"]);
  });

  it("treats the same letters written with combining accents as one option", () => {
    const [card] = toWarmUpCards([
      rawCard({
        options: [
          { correct: true, text: "Café" },
          { correct: false, text: "Café" },
          { correct: false, text: "Chá" },
        ],
      }),
    ]);

    expect(card?.options.map((option) => option.text).toSorted()).toStrictEqual(["Café", "Chá"]);
  });

  it("merges options that differ only in case or spacing, keeping the right one right", () => {
    const [card] = toWarmUpCards([
      rawCard({
        options: [
          { correct: false, text: "Ice cream" },
          { correct: true, text: "icecream" },
          { correct: false, text: "Sorbet" },
        ],
      }),
    ]);

    expect(card?.options).toHaveLength(2);
    expect(card?.options.find((option) => option.correct)?.text).toBe("Ice cream");
  });

  it("keeps a card whose right answer was written twice as one right option", () => {
    const [card] = toWarmUpCards([
      rawCard({
        options: [
          { correct: true, text: "Grávida" },
          { correct: true, text: "grávida" },
          { correct: false, text: "Envergonhada" },
        ],
      }),
    ]);

    expect(card?.options.filter((option) => option.correct)).toHaveLength(1);
  });

  it.each([
    [
      "no right option",
      {
        options: [
          { correct: false, text: "Two" },
          { correct: false, text: "Eight" },
        ],
      },
    ],
    [
      "two right options",
      {
        options: [
          { correct: true, text: "Five" },
          { correct: true, text: "Two" },
        ],
      },
    ],
    ["one option", { options: [{ correct: true, text: "Five" }] }],
    [
      "four options",
      {
        options: [
          { correct: true, text: "Five" },
          { correct: false, text: "Two" },
          { correct: false, text: "Eight" },
          { correct: false, text: "Ten" },
        ],
      },
    ],
    [
      "options that merge into one",
      {
        options: [
          { correct: true, text: "Five" },
          { correct: false, text: "five" },
        ],
      },
    ],
    ["a placeholder", { question: "[Insert question about bees here]" }],
    ["an empty reveal", { reveal: "  " }],
    ["a question too long for the card", { question: `${"Why ".repeat(41)}?` }],
    [
      "an option too long for the card",
      {
        options: [
          { correct: true, text: "a".repeat(61) },
          { correct: false, text: "b" },
        ],
      },
    ],
    ["a reveal too long for the card", { reveal: "b".repeat(281) }],
  ])("drops a card with %s and keeps the others' ids", (_case, overrides) => {
    const cards = toWarmUpCards([rawCard(overrides), rawCard()]);

    expect(cards.map((card) => card.id)).toStrictEqual(["2"]);
  });

  it("shuffles the same card the same way every time", () => {
    const deck = Array.from({ length: 8 }, (_, index) =>
      rawCard({ question: `Question number ${index + 1} about bees?` }),
    );

    expect(optionTexts(toWarmUpCards(deck))).toStrictEqual(optionTexts(toWarmUpCards(deck)));
  });

  it("doesn't leave the writer's right-first order in place across a deck", () => {
    const deck = Array.from({ length: 8 }, (_, index) =>
      rawCard({ question: `Question number ${index + 1} about bees?` }),
    );

    const rightPositions = toWarmUpCards(deck).map((card) =>
      card.options.findIndex((option) => option.correct),
    );

    expect(new Set(rightPositions).size).toBeGreaterThan(1);
  });

  it("puts options that differ only in one number in ascending order", () => {
    const cards = toWarmUpCards([
      rawCard({
        options: [
          { correct: true, text: "5" },
          { correct: false, text: "8" },
          { correct: false, text: "2" },
        ],
      }),
      rawCard({
        options: [
          { correct: true, text: "R$ 60" },
          { correct: false, text: "R$ 64" },
          { correct: false, text: "R$ 55" },
        ],
      }),
      rawCard({
        options: [
          { correct: false, text: "1,5 kg" },
          { correct: true, text: "1.000 kg" },
          { correct: false, text: "12 kg" },
        ],
      }),
      rawCard({
        options: [
          { correct: false, text: "0 °C" },
          { correct: true, text: "−5 °C" },
        ],
      }),
      rawCard({
        options: [
          { correct: false, text: "1" },
          { correct: true, text: "0.125" },
          { correct: false, text: "0.5" },
        ],
      }),
    ]);

    expect(optionTexts(cards)).toStrictEqual([
      ["2", "5", "8"],
      ["R$ 55", "R$ 60", "R$ 64"],
      ["1,5 kg", "12 kg", "1.000 kg"],
      ["−5 °C", "0 °C"],
      ["0.125", "0.5", "1"],
    ]);
  });

  it("shuffles options that mix numbers and words", () => {
    const cards = toWarmUpCards(
      Array.from({ length: 8 }, (_, index) =>
        rawCard({
          options: [
            { correct: true, text: "2 eyes" },
            { correct: false, text: "5" },
            { correct: false, text: "8 legs" },
          ],
          question: `Question number ${index + 1}?`,
        }),
      ),
    );

    expect(new Set(optionTexts(cards).map((texts) => texts.join("\n"))).size).toBeGreaterThan(1);
  });
});
