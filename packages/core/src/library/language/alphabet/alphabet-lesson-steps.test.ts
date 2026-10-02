import { describe, expect, it } from "vitest";
import { buildAlphabetLessonSteps } from "./alphabet-lesson-steps";

const HIRAGANA = [
  ["あ", "a"],
  ["い", "i"],
  ["う", "u"],
  ["え", "e"],
  ["お", "o"],
  ["か", "ka"],
  ["き", "ki"],
] as const;

function letter([symbol = "", readingAid = ""]: readonly string[]) {
  return { audioText: symbol, forms: [], pronunciation: `Like ${readingAid}.`, readingAid, symbol };
}

const content = {
  canDo: "Read and say the five hiragana vowels",
  description: "Read the vowels every Japanese word is built on.",
  intro: [{ text: "Each hiragana is one syllable.", title: "One sound per character" }],
  letters: [
    ["あ", "a"],
    ["か", "ka"],
  ].map((pair) => letter(pair)),
  script: "Hiragana",
  summary: ["Each character is a syllable.", "Vowels are short and pure."],
  title: "Your first hiragana",
};

describe(buildAlphabetLessonSteps, () => {
  it("lays out the intro, a card per letter with its clip, a match and the summary, without empty letters", () => {
    const steps = buildAlphabetLessonSteps({
      audioUrls: new Map([["あ", "https://audio.test/a.mp3"]]),
      content: {
        ...content,
        letters: [
          ...content.letters,
          { audioText: "", forms: [], pronunciation: "", readingAid: "", symbol: " " },
        ],
      },
    });

    expect(steps.map((step) => step.kind)).toStrictEqual([
      "explanation",
      "alphabet",
      "alphabet",
      "matchColumns",
      "summary",
    ]);

    expect(steps[1]?.content).toMatchObject({ audioUrl: "https://audio.test/a.mp3", symbol: "あ" });
    expect(steps[2]?.content).toMatchObject({ audioUrl: null, readingAid: "ka", symbol: "か" });

    expect(steps[3]?.content).toStrictEqual({
      pairs: [
        { left: "あ", right: "a" },
        { left: "か", right: "ka" },
      ],
    });
  });

  it("teaches seven letters as four cards and a match, then three cards and a match", () => {
    const steps = buildAlphabetLessonSteps({
      audioUrls: new Map(),
      content: { ...content, letters: HIRAGANA.map((pair) => letter(pair)) },
    });

    expect(steps.map((step) => step.kind)).toStrictEqual([
      "explanation",
      ...Array.from({ length: 4 }, () => "alphabet"),
      "matchColumns",
      ...Array.from({ length: 3 }, () => "alphabet"),
      "matchColumns",
      "summary",
    ]);

    expect(steps[9]?.content).toStrictEqual({
      pairs: [
        { left: "お", right: "o" },
        { left: "か", right: "ka" },
        { left: "き", right: "ki" },
      ],
    });
  });

  it("keeps a romanization shared by two letters out of their match, so each pair has one answer", () => {
    const steps = buildAlphabetLessonSteps({
      audioUrls: new Map(),
      content: {
        ...content,
        letters: [
          ["е", "e"],
          ["э", "e"],
          ["а", "a"],
        ].map((pair) => letter(pair)),
      },
    });

    expect(steps.find((step) => step.kind === "matchColumns")?.content).toStrictEqual({
      pairs: [
        { left: "е", right: "e" },
        { left: "а", right: "a" },
      ],
    });
  });
});
