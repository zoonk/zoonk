import { describe, expect, it } from "vitest";
import { type WordBankOption } from "./prepare-lesson-data";
import { buildReadingPromptWords } from "./reading-prompt-words";

function sentenceWords(words: [word: string, translation: string | null][]): WordBankOption[] {
  return words.map(([word, translation]) => ({
    audioUrl: null,
    romanization: null,
    translation,
    word,
  }));
}

describe(buildReadingPromptWords, () => {
  it("shows each prompt word the sentence word whose translation it is", () => {
    expect(
      buildReadingPromptWords({
        prompt: "Eu gosto de café.",
        sentenceWordOptions: sentenceWords([
          ["I", "eu"],
          ["like", "gosto"],
          ["coffee.", null],
        ]),
      }),
    ).toStrictEqual([
      { translation: "I", word: "Eu" },
      { translation: "like", word: "gosto" },
      { translation: null, word: "de" },
      { translation: null, word: "café." },
    ]);
  });

  it("matches without punctuation or case and shows the word without punctuation", () => {
    expect(
      buildReadingPromptWords({
        prompt: "Olá!",
        sentenceWordOptions: sentenceWords([["Hello!", "olá"]]),
      }),
    ).toStrictEqual([{ translation: "Hello", word: "Olá!" }]);
  });

  it("keeps the accents that tell words apart", () => {
    expect(
      buildReadingPromptWords({
        prompt: "Minha avó e meu avô moram aqui.",
        sentenceWordOptions: sentenceWords([
          ["My", null],
          ["grandfather", "avô"],
          ["and", null],
          ["grandmother", "avó"],
          ["live", null],
          ["here.", null],
        ]),
      }),
    ).toStrictEqual([
      { translation: null, word: "Minha" },
      { translation: "grandmother", word: "avó" },
      { translation: null, word: "e" },
      { translation: null, word: "meu" },
      { translation: "grandfather", word: "avô" },
      { translation: null, word: "moram" },
      { translation: null, word: "aqui." },
    ]);

    expect(
      buildReadingPromptWords({
        prompt: "Esta casa está vazia.",
        sentenceWordOptions: sentenceWords([
          ["This", null],
          ["house", "casa"],
          ["is", "está"],
          ["empty.", "vazia"],
        ]),
      }),
    ).toStrictEqual([
      { translation: null, word: "Esta" },
      { translation: "house", word: "casa" },
      { translation: "is", word: "está" },
      { translation: "empty", word: "vazia." },
    ]);
  });

  it("gives a repeated word each matching sentence word once", () => {
    expect(
      buildReadingPromptWords({
        prompt: "o gato e o cão e o",
        sentenceWordOptions: sentenceWords([
          ["The", "o"],
          ["cat", "gato"],
          ["and", "e"],
          ["the", "o"],
          ["dog", "cão"],
        ]),
      }),
    ).toStrictEqual([
      { translation: "The", word: "o" },
      { translation: "cat", word: "gato" },
      { translation: "and", word: "e" },
      { translation: "the", word: "o" },
      { translation: "dog", word: "cão" },
      { translation: null, word: "e" },
      { translation: null, word: "o" },
    ]);
  });

  it("shows nothing on a word two different sentence words translate", () => {
    expect(
      buildReadingPromptWords({
        prompt: "um carro e um ônibus",
        sentenceWordOptions: sentenceWords([
          ["a", "um"],
          ["car", "carro"],
          ["and", "e"],
          ["one", "um"],
          ["bus", "ônibus"],
        ]),
      }),
    ).toStrictEqual([
      { translation: null, word: "um" },
      { translation: "car", word: "carro" },
      { translation: "and", word: "e" },
      { translation: null, word: "um" },
      { translation: "bus", word: "ônibus" },
    ]);
  });

  it.each([
    {
      expected: [
        { translation: null, word: "Meu" },
        { translation: null, word: "cartão" },
        { translation: null, word: "de" },
        { translation: null, word: "embarque" },
        { translation: null, word: "indica" },
        { translation: null, word: "o" },
        { translation: null, word: "portão" },
        { translation: null, word: "B12" },
      ],
      prompt: "Meu cartão de embarque indica o portão B12",
      sentence: [
        ["My", null],
        ["boarding", null],
        ["pass", null],
        ["says", null],
        ["gate", "o portão"],
        ["B12", null],
      ],
    },
    {
      expected: [
        { translation: null, word: "Onde" },
        { translation: null, word: "fica" },
        { translation: null, word: "o" },
        { translation: null, word: "portão" },
        { translation: null, word: "B12?" },
      ],
      prompt: "Onde fica o portão B12?",
      sentence: [
        ["Where", null],
        ["is", null],
        ["gate", "o portão"],
        ["B12?", null],
      ],
    },
    {
      expected: [
        { translation: null, word: "Quanto" },
        { translation: null, word: "eu" },
        { translation: null, word: "pago" },
        { translation: "upfront", word: "antecipadamente?" },
      ],
      prompt: "Quanto eu pago antecipadamente?",
      sentence: [
        ["How", null],
        ["much", null],
        ["do", null],
        ["I", null],
        ["pay", "pagar"],
        ["upfront?", "antecipadamente"],
      ],
    },
    {
      expected: [
        { translation: null, word: "Tenha" },
        { translation: "a", word: "um" },
        { translation: null, word: "bom" },
        { translation: "day", word: "dia!" },
      ],
      prompt: "Tenha um bom dia!",
      sentence: [
        ["Have", "ter"],
        ["a", "um"],
        ["nice", "legal"],
        ["day!", "dia"],
      ],
    },
  ] satisfies {
    expected: { translation: string | null; word: string }[];
    prompt: string;
    sentence: [string, string | null][];
  }[])(
    "shows nothing on a word no sentence word translates: $prompt",
    ({ expected, prompt, sentence }) => {
      expect(
        buildReadingPromptWords({ prompt, sentenceWordOptions: sentenceWords(sentence) }),
      ).toStrictEqual(expected);
    },
  );

  it("keeps the vowel signs that tell words apart and end them", () => {
    expect(
      buildReadingPromptWords({
        prompt: "काम कम",
        sentenceWordOptions: sentenceWords([
          ["little", "कम"],
          ["work", "काम"],
        ]),
      }),
    ).toStrictEqual([
      { translation: "work", word: "काम" },
      { translation: "little", word: "कम" },
    ]);

    expect(
      buildReadingPromptWords({
        prompt: "Hello, good!",
        sentenceWordOptions: sentenceWords([
          ["नमस्ते,", "hello"],
          ["ดี!", "good"],
        ]),
      }),
    ).toStrictEqual([
      { translation: "नमस्ते", word: "Hello," },
      { translation: "ดี", word: "good!" },
    ]);
  });

  it("splits a prompt without spaces at the words a dictionary finds", () => {
    expect(
      buildReadingPromptWords({
        prompt: "新幹線に乗ります。",
        sentenceWordOptions: sentenceWords([
          ["I", null],
          ["take", "乗る"],
          ["the", null],
          ["train.", "新幹線"],
        ]),
      }),
    ).toStrictEqual([
      { translation: "train", word: "新幹線" },
      { translation: null, word: "に" },
      { translation: null, word: "乗り" },
      { translation: null, word: "ます。" },
    ]);

    expect(
      buildReadingPromptWords({
        prompt: "ฉันชอบกาแฟ",
        sentenceWordOptions: sentenceWords([
          ["I", "ฉัน"],
          ["like", "ชอบ"],
          ["coffee", "กาแฟ"],
        ]),
      }),
    ).toStrictEqual([
      { translation: "I", word: "ฉัน" },
      { translation: "like", word: "ชอบ" },
      { translation: "coffee", word: "กาแฟ" },
    ]);
  });

  it("drops the quotes around the whole prompt and keeps punctuation on its word", () => {
    expect(
      buildReadingPromptWords({
        prompt: "“Oui , je suis là !”",
        sentenceWordOptions: sentenceWords([
          ["Yes,", "oui"],
          ["here!", "là"],
        ]),
      }),
    ).toStrictEqual([
      { translation: "Yes", word: "Oui," },
      { translation: null, word: "je" },
      { translation: null, word: "suis" },
      { translation: "here", word: "là!" },
    ]);
  });
});
