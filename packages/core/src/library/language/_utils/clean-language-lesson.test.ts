import { describe, expect, it } from "vitest";
import { languageLessonDraft } from "../_test-utils/language-lesson-draft";
import { cleanLanguageLesson } from "./clean-language-lesson";

describe(cleanLanguageLesson, () => {
  it("keeps a clean draft as it is", () => {
    const draft = languageLessonDraft();

    expect(cleanLanguageLesson({ content: draft, knownWords: [] })).toStrictEqual({
      ...draft,
      words: draft.words.map((word) =>
        word.word === "the rent" ? { ...word, distractors: ["income", "salary"] } : word,
      ),
    });
  });

  it("drops wrong options that are right: the word itself, another new word, or a word of the sentence", () => {
    const draft = languageLessonDraft();
    const [rent, deposit] = draft.words;
    const [question] = draft.sentences;

    const cleaned = cleanLanguageLesson({
      content: languageLessonDraft({
        sentences: [
          {
            ...question!,
            distractors: ["the", "Rent?", "cost"],
            translationDistractors: ["Quanto", "renda"],
          },
          ...draft.sentences.slice(1),
        ],
        words: [{ ...rent!, distractors: ["The rent", "the deposit", "income"] }, deposit!],
      }),
      knownWords: [],
    });

    expect(cleaned.words[0]?.distractors).toStrictEqual(["income"]);
    expect(cleaned.sentences[0]?.distractors).toStrictEqual(["cost"]);
    expect(cleaned.sentences[0]?.translationDistractors).toStrictEqual(["renda"]);
  });

  it("doesn't teach a word the unit already taught, or the same word twice", () => {
    const draft = languageLessonDraft();

    const cleaned = cleanLanguageLesson({
      content: { ...draft, words: [...draft.words, { ...draft.words[1]!, word: "The deposit " }] },
      knownWords: ["the rent"],
    });

    expect(cleaned.words.map((word) => word.word)).toStrictEqual(["the deposit", "the utilities"]);
  });

  it("drops practice without exactly one blank or whose wrong options are all the answer", () => {
    const [practice] = languageLessonDraft().practice;

    const cleaned = cleanLanguageLesson({
      content: languageLessonDraft({
        practice: [
          { ...practice!, template: "How much is the rent?" },
          { ...practice!, template: "[BLANK] much [BLANK] the rent?" },
          { ...practice!, distractors: ["is", "Is"] },
          practice!,
        ],
      }),
      knownWords: [],
    });

    expect(cleaned.practice).toStrictEqual([practice]);
  });

  it("tidies spacing before punctuation and empty notes", () => {
    const draft = languageLessonDraft();

    const cleaned = cleanLanguageLesson({
      content: {
        ...draft,
        sentences: [
          { ...draft.sentences[0]!, sentence: "How much is the rent ?" },
          ...draft.sentences.slice(1),
        ],
        words: [{ ...draft.words[0]!, note: "  ", tip: "" }, ...draft.words.slice(1)],
      },
      knownWords: [],
    });

    expect(cleaned.sentences[0]?.sentence).toBe("How much is the rent?");
    expect(cleaned.words[0]).toMatchObject({ note: null, tip: null });
  });
});
