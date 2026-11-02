import { type PublishedAlphabetLesson } from "@zoonk/ai/tasks/language/alphabet-lesson";
import { describe, expect, it } from "vitest";
import {
  type AlphabetCheck,
  checkAlphabetFix,
  checkAlphabetLesson,
} from "./alphabet-lesson-validator";

type Letter = PublishedAlphabetLesson["letters"][number];

function letter(symbol: string, readingAid: string, audioText = symbol): Letter {
  return {
    audioText,
    forms: [],
    pronunciation: `Like ${readingAid}; you'll hear ${audioText} (${readingAid}).`,
    readingAid,
    symbol,
  };
}

const CYRILLIC: PublishedAlphabetLesson = {
  canDo: "Read and say в, о and к.",
  description: "Your first Russian letters.",
  intro: [{ text: "Read left to right.", title: "Direction" }],
  letters: [letter("в", "v", "ва"), letter("о", "o"), letter("к", "k", "ка")],
  summary: ["Read one letter at a time."],
  title: "First Russian letters",
};

function failures(checks: readonly AlphabetCheck[]): string[] {
  return checks.flatMap((check) => (check.passed ? [] : [check.problem]));
}

function withLetter(lesson: PublishedAlphabetLesson, index: number, changes: Partial<Letter>) {
  return {
    ...lesson,
    letters: lesson.letters.map((current, position) =>
      position === index ? { ...current, ...changes } : current,
    ),
  };
}

function checkRussian(lesson: PublishedAlphabetLesson) {
  return failures(checkAlphabetLesson({ lesson, targetLanguage: "ru" }));
}

describe(checkAlphabetLesson, () => {
  it("passes a lesson whose letters are all real and whole", () => {
    expect(checkRussian(CYRILLIC)).toStrictEqual([]);
  });

  it("fails a romanization of only spaces, which would lose its card", () => {
    expect(checkRussian(withLetter(CYRILLIC, 1, { readingAid: "  " }))).toStrictEqual([
      "A letter's romanization has no Latin letters.",
      "A screen was lost when the lesson's steps were built.",
    ]);
  });

  it("fails a repeated or Latin symbol, a missing audio text and a syllable the cue never shows", () => {
    expect(
      checkRussian({
        ...CYRILLIC,
        letters: [
          letter("в", "v", "ва"),
          letter("в", "v"),
          { ...letter("o", "o"), audioText: " " },
          { ...letter("к", "k"), audioText: "ко" },
        ],
      }),
    ).toStrictEqual([
      "Two letters share a symbol.",
      "A symbol is empty or written in Latin letters.",
      "A letter has no text for its audio.",
      "A card plays a syllable its sound cue never shows.",
    ]);
  });

  it("asks a connected script for its joining forms, and lets only scripts with final forms have them", () => {
    const forms = [{ label: "final", symbol: "ך" }];
    const hebrew = withLetter(CYRILLIC, 0, { forms, symbol: "כ" });

    expect(failures(checkAlphabetLesson({ lesson: CYRILLIC, targetLanguage: "ar" }))).toContain(
      "A connected script's letters have no joining forms.",
    );

    expect(checkRussian(withLetter(CYRILLIC, 0, { forms }))).toStrictEqual([
      "Letters of a script without positional forms have forms.",
    ]);

    expect(failures(checkAlphabetLesson({ lesson: hebrew, targetLanguage: "he" }))).toStrictEqual(
      [],
    );
  });
});

function checkFix(fixed: PublishedAlphabetLesson, screen: number | null, lesson = CYRILLIC) {
  return failures(
    checkAlphabetFix({ fixed, lesson, problems: [{ screen }], targetLanguage: "ru" }),
  );
}

describe(checkAlphabetFix, () => {
  it("accepts a fix to an intro screen, to a romanization alone or to the whole lesson's words", () => {
    const intro = [{ text: "Read from left to right.", title: "Direction" }];

    expect(checkFix({ ...CYRILLIC, intro }, 0)).toStrictEqual([]);
    expect(checkFix(CYRILLIC, 3, withLetter(CYRILLIC, 2, { readingAid: "c" }))).toStrictEqual([]);
    expect(checkFix({ ...CYRILLIC, canDo: "Read and say в, о, к." }, null)).toStrictEqual([]);
  });

  it("rejects a fix that leaves a flagged part as it was or breaks the lesson", () => {
    expect(checkFix(withLetter(CYRILLIC, 1, { pronunciation: "Like o." }), 1)).toStrictEqual([
      "Screen 2 wasn't changed.",
    ]);

    expect(checkFix(CYRILLIC, null)).toStrictEqual(["The whole lesson wasn't changed."]);

    expect(checkFix(withLetter(CYRILLIC, 1, { readingAid: " " }), 2)).toStrictEqual([
      "A letter's romanization has no Latin letters.",
      "A screen was lost when the lesson's steps were built.",
    ]);
  });
});
