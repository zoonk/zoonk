import { describe, expect, it } from "vitest";
import { type PlayableLanguageStep } from "../playable-lesson";
import { showStepOptions } from "./shown-step-options";

const SENTENCE = ["I", "like", "green", "apples"];
const BANK = ["apples", "green", "I", "like", "red", "you"];

function tile(word: string) {
  return { audioUrl: null, romanization: null, translation: null, word };
}

const reading: PlayableLanguageStep = {
  exercise: {
    content: {},
    fillBlankOptions: [],
    id: "0199a0b1-0000-7000-8000-0000000000aa",
    kind: "reading",
    matchColumnsRightItems: [],
    position: 0,
    readingPromptWords: [],
    sentence: null,
    sentenceWordOptions: SENTENCE.map((word) => tile(word)),
    translationOptions: [],
    vocabularyOptions: [],
    word: null,
    wordBankOptions: BANK.map((word) => tile(word)),
  },
  id: "0199a0b1-0000-7000-8000-0000000000aa",
  kind: "reading",
  position: 0,
  skillId: null,
  wordHints: null,
};

function words(step: ReturnType<typeof showStepOptions>, list: "sentence" | "bank") {
  if (!("exercise" in step)) {
    throw new Error("Expected a language step");
  }

  const tiles =
    list === "sentence" ? step.exercise.sentenceWordOptions : step.exercise.wordBankOptions;

  return tiles.map((option) => option.word);
}

describe(showStepOptions, () => {
  it("shows the same bank in different orders for different sittings", () => {
    const first = words(showStepOptions({ seed: "first sitting", step: reading }), "bank");

    const orders = ["second", "third", "fourth", "fifth"].map((seed) =>
      words(showStepOptions({ seed, step: reading }), "bank"),
    );

    for (const order of orders) {
      expect(order.toSorted()).toStrictEqual(first.toSorted());
    }

    expect(orders.some((order) => order.join(" ") !== first.join(" "))).toBe(true);
  });

  it("keeps a reading's sentence in its order, since apps check the arranged answer against it", () => {
    const shown = showStepOptions({ seed: "sitting", step: reading });

    expect(words(shown, "sentence")).toStrictEqual(SENTENCE);
    expect(words(shown, "bank")).not.toStrictEqual(BANK);
    expect(words(shown, "bank").toSorted()).toStrictEqual(BANK.toSorted());
  });
});
