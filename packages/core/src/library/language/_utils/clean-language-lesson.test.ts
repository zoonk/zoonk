import { describe, expect, it } from "vitest";
import { languageLessonDraft, sameLanguageLessonDraft } from "../_test-utils/language-lesson-draft";
import { cleanLanguageLesson } from "./clean-language-lesson";

describe(cleanLanguageLesson, () => {
  it("keeps a clean draft as it is", () => {
    const draft = languageLessonDraft();

    expect(
      cleanLanguageLesson({ content: draft, knownWords: [], sameLanguage: false }),
    ).toStrictEqual({
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
      sameLanguage: false,
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
      sameLanguage: false,
    });

    expect(cleaned.words.map((word) => word.word)).toStrictEqual(["the deposit", "the utilities"]);
  });

  it("keeps words that differ only by accents or tone marks apart", () => {
    const draft = languageLessonDraft();
    const [word] = draft.words;
    const [sentence] = draft.sentences;
    const [practice] = draft.practice;

    const cleaned = cleanLanguageLesson({
      content: languageLessonDraft({
        practice: [
          {
            ...practice!,
            answer: "mà",
            distractors: ["ma", "má", "để"],
            template: "Tôi mệt [BLANK] vẫn đi",
          },
        ],
        sentences: [
          { ...sentence!, distractors: ["ma", "má", "mạ"], sentence: "Tôi mệt mà vẫn đi" },
        ],
        words: [
          { ...word!, distractors: ["má", "mả", "mã"], translation: "ghost", word: "ma" },
          { ...word!, distractors: ["ma"], translation: "mom", word: "má" },
          { ...word!, distractors: ["ma"], translation: "but", word: "mà" },
          { ...word!, translation: "seedling", word: "mạ" },
          { ...word!, translation: "but", word: "mà" },
        ],
      }),
      knownWords: ["mạ"],
      sameLanguage: false,
    });

    expect(cleaned.words.map((item) => item.word)).toStrictEqual(["ma", "má", "mà"]);
    expect(cleaned.words[0]?.distractors).toStrictEqual(["mả", "mã"]);
    expect(cleaned.sentences[0]?.distractors).toStrictEqual(["ma", "má", "mạ"]);
    expect(cleaned.practice[0]?.distractors).toStrictEqual(["ma", "má", "để"]);
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
      sameLanguage: false,
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
      sameLanguage: false,
    });

    expect(cleaned.sentences[0]?.sentence).toBe("How much is the rent?");
    expect(cleaned.words[0]).toMatchObject({ note: null, tip: null });
  });

  it("in the learner's own language, drops a word defined by itself and reads each sentence as it is", () => {
    const draft = sameLanguageLessonDraft();
    const [first, ...rest] = draft.sentences;

    const cleaned = cleanLanguageLesson({
      content: {
        ...draft,
        sentences: [
          { ...first!, translation: "Plants require water", translationDistractors: ["require"] },
          ...rest,
        ],
        tip: {
          ...draft.tip,
          examples: [{ sentence: "Plants need water", translation: "Plants require water" }],
        },
      },
      knownWords: [],
      sameLanguage: true,
    });

    expect(cleaned.words.map((word) => word.word)).toStrictEqual(["water", "grow"]);

    expect(
      cleaned.sentences.map((sentence) => [sentence.translation, sentence.translationDistractors]),
    ).toStrictEqual(draft.sentences.map((sentence) => [sentence.sentence, sentence.distractors]));

    expect(cleaned.tip.examples).toStrictEqual([
      { sentence: "Plants need water", translation: "Plants need water" },
    ]);
  });

  it("keeps a word whose translation looks like it in another language", () => {
    const draft = languageLessonDraft();
    const [rent, ...rest] = draft.words;

    const cleaned = cleanLanguageLesson({
      content: { ...draft, words: [{ ...rent!, translation: "the rent" }, ...rest] },
      knownWords: [],
      sameLanguage: false,
    });

    expect(cleaned.words).toHaveLength(draft.words.length);
  });
});
