import { describe, expect, it } from "vitest";
import { buildReadingPromptWords } from "./reading-prompt-words";

const pt = { languages: { language: "pt", targetLanguage: "en" } };

function vocabulary(words: [word: string, translation: string][]) {
  return words.map(([word, translation]) => ({ translation, word }));
}

describe(buildReadingPromptWords, () => {
  it("shows each prompt word the sentence word whose translation it is", () => {
    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "Eu gosto de café.",
        sentence: "I like coffee.",
        vocabulary: vocabulary([
          ["I", "eu"],
          ["like", "gosto"],
        ]),
      }),
    ).toStrictEqual([
      { translation: "I", word: "Eu" },
      { translation: "like", word: "gosto" },
      { translation: null, word: "de" },
      { translation: null, word: "café." },
    ]);
  });

  it("matches without punctuation or case and shows the word as the sentence writes it", () => {
    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "Olá!",
        sentence: "Hello!",
        vocabulary: vocabulary([["hello", "olá"]]),
      }),
    ).toStrictEqual([{ translation: "Hello", word: "Olá!" }]);
  });

  it("keeps the accents that tell words apart", () => {
    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "Minha avó e meu avô moram aqui.",
        sentence: "My grandfather and grandmother live here.",
        vocabulary: vocabulary([
          ["grandfather", "avô"],
          ["grandmother", "avó"],
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
        ...pt,
        prompt: "Esta casa está vazia.",
        sentence: "This house is empty.",
        vocabulary: vocabulary([
          ["house", "casa"],
          ["is", "está"],
          ["empty", "vazia"],
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
        ...pt,
        prompt: "o gato e o cão e o",
        sentence: "The cat and the dog",
        vocabulary: vocabulary([
          ["the", "o"],
          ["cat", "gato"],
          ["and", "e"],
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
        ...pt,
        prompt: "um carro e um ônibus",
        sentence: "a car and one bus",
        vocabulary: vocabulary([
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

  it("shows a sentence word on the phrase that translates it", () => {
    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "Meu cartão de embarque indica o portão B12",
        sentence: "My boarding pass says gate B12",
        vocabulary: vocabulary([["gate", "o portão"]]),
      }),
    ).toStrictEqual([
      { translation: null, word: "Meu" },
      { translation: null, word: "cartão" },
      { translation: null, word: "de" },
      { translation: null, word: "embarque" },
      { translation: null, word: "indica" },
      { translation: "gate", word: "o portão" },
      { translation: null, word: "B12" },
    ]);
  });

  it("shows a phrase of the sentence on the words that translate it", () => {
    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "O aluguel é de US$ 1.200 por mês.",
        sentence: "The rent is $1,200 per month.",
        vocabulary: vocabulary([
          ["the rent", "o aluguel"],
          ["per month", "por mês"],
        ]),
      }),
    ).toStrictEqual([
      { translation: "The rent", word: "O aluguel" },
      { translation: null, word: "é" },
      { translation: null, word: "de" },
      { translation: null, word: "US$" },
      { translation: null, word: "1.200" },
      { translation: "per month", word: "por mês." },
    ]);

    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "The menu, please",
        sentence: "O cardápio, por favor",
        vocabulary: vocabulary([
          ["o cardápio", "the menu"],
          ["por favor", "please"],
        ]),
      }),
    ).toStrictEqual([
      { translation: "O cardápio", word: "The menu," },
      { translation: "por favor", word: "please" },
    ]);
  });

  it("shows the phrase, not the word inside it, where both start", () => {
    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "Onde fica o portão?",
        sentence: "Where is the gate?",
        vocabulary: vocabulary([
          ["the", "o"],
          ["gate", "o portão"],
        ]),
      }),
    ).toStrictEqual([
      { translation: null, word: "Onde" },
      { translation: null, word: "fica" },
      { translation: "gate", word: "o portão?" },
    ]);

    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "Meu andar fica no andar de cima",
        sentence: "My floor is upstairs",
        vocabulary: vocabulary([
          ["floor", "andar"],
          ["upstairs", "no andar de cima"],
        ]),
      }),
    ).toStrictEqual([
      { translation: null, word: "Meu" },
      { translation: "floor", word: "andar" },
      { translation: null, word: "fica" },
      { translation: "upstairs", word: "no andar de cima" },
    ]);
  });

  it("gives each prompt word one hint when phrases overlap", () => {
    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "Estou com dor de cabeça desde ontem",
        sentence: "I've had a headache since yesterday",
        vocabulary: vocabulary([
          ["I've had", "estou com"],
          ["a headache", "com dor de cabeça"],
          ["since yesterday", "desde ontem"],
        ]),
      }),
    ).toStrictEqual([
      { translation: "I've had", word: "Estou com" },
      { translation: null, word: "dor" },
      { translation: null, word: "de" },
      { translation: null, word: "cabeça" },
      { translation: "since yesterday", word: "desde ontem" },
    ]);
  });

  it("shows nothing on a phrase two different sentence phrases translate", () => {
    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "A conta, por favor",
        sentence: "The bill, please",
        vocabulary: vocabulary([
          ["the bill", "a conta"],
          ["the check", "a conta"],
          ["please", "por favor"],
        ]),
      }),
    ).toStrictEqual([
      { translation: "The bill", word: "A conta," },
      { translation: "please", word: "por favor" },
    ]);

    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "A conta ou a conta?",
        sentence: "The bill or the check?",
        vocabulary: vocabulary([
          ["the bill", "a conta"],
          ["the check", "a conta"],
        ]),
      }),
    ).toStrictEqual([
      { translation: null, word: "A" },
      { translation: null, word: "conta" },
      { translation: null, word: "ou" },
      { translation: null, word: "a" },
      { translation: null, word: "conta?" },
    ]);
  });

  it.each([
    {
      expected: [
        { translation: null, word: "Quanto" },
        { translation: null, word: "eu" },
        { translation: null, word: "pago" },
        { translation: "upfront", word: "antecipadamente?" },
      ],
      prompt: "Quanto eu pago antecipadamente?",
      sentence: "How much do I pay upfront?",
      words: [
        ["pay", "pagar"],
        ["upfront", "antecipadamente"],
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
      sentence: "Have a nice day!",
      words: [
        ["have", "ter"],
        ["a", "um"],
        ["nice", "legal"],
        ["day", "dia"],
      ],
    },
  ] satisfies {
    expected: { translation: string | null; word: string }[];
    prompt: string;
    sentence: string;
    words: [string, string][];
  }[])(
    "shows nothing on a word no sentence word translates: $prompt",
    ({ expected, prompt, sentence, words }) => {
      expect(
        buildReadingPromptWords({ ...pt, prompt, sentence, vocabulary: vocabulary(words) }),
      ).toStrictEqual(expected);
    },
  );

  it("keeps the vowel signs that tell words apart and end them", () => {
    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "काम कम",
        sentence: "little work",
        vocabulary: vocabulary([
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
        ...pt,
        prompt: "Hello, good!",
        sentence: "नमस्ते, ดี!",
        vocabulary: vocabulary([
          ["नमस्ते", "hello"],
          ["ดี", "good"],
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
        ...pt,
        prompt: "新幹線に乗ります。",
        sentence: "I take the train.",
        vocabulary: vocabulary([
          ["take", "乗る"],
          ["train", "新幹線"],
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
        ...pt,
        prompt: "ฉันชอบกาแฟ",
        sentence: "I like coffee",
        vocabulary: vocabulary([
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

  it("joins the words of a phrase without spaces in scripts without them", () => {
    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "新幹線に乗ります。",
        sentence: "I take the shinkansen.",
        vocabulary: vocabulary([
          ["take", "乗ります"],
          ["the shinkansen", "新幹線"],
        ]),
      }),
    ).toStrictEqual([
      { translation: "the shinkansen", word: "新幹線" },
      { translation: null, word: "に" },
      { translation: "take", word: "乗ります。" },
    ]);

    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "I take the shinkansen.",
        sentence: "新幹線に乗ります。",
        vocabulary: vocabulary([["新幹線に乗ります", "take the shinkansen"]]),
      }),
    ).toStrictEqual([
      { translation: null, word: "I" },
      { translation: "新幹線に乗ります", word: "take the shinkansen." },
    ]);
  });

  it("never matches a phrase across a different split of the same letters", () => {
    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "O agente chegou",
        sentence: "We arrived",
        vocabulary: vocabulary([["we", "a gente"]]),
      }),
    ).toStrictEqual([
      { translation: null, word: "O" },
      { translation: null, word: "agente" },
      { translation: null, word: "chegou" },
    ]);
  });

  it("tells apart words that differ by an apostrophe, whichever apostrophe they use", () => {
    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "Vou ficar em casa, estou doente",
        sentence: "I'll stay home, I feel sick",
        vocabulary: vocabulary([["ill", "doente"]]),
      }),
    ).toStrictEqual([
      { translation: null, word: "Vou" },
      { translation: null, word: "ficar" },
      { translation: null, word: "em" },
      { translation: null, word: "casa," },
      { translation: null, word: "estou" },
      { translation: null, word: "doente" },
    ]);

    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "I’d like the menu",
        sentence: "Queria o cardápio",
        vocabulary: vocabulary([
          ["queria", "I'd like"],
          ["o cardápio", "the menu"],
        ]),
      }),
    ).toStrictEqual([
      { translation: "Queria", word: "I’d like" },
      { translation: "o cardápio", word: "the menu" },
    ]);
  });

  it("never lends a word of a phrase to a shorter hint inside it", () => {
    const newYork = vocabulary([
      ["New York", "Nova Iorque"],
      ["new", "novo"],
    ]);

    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "Nova Iorque tem um museu novo.",
        sentence: "New York has a recently opened museum.",
        vocabulary: newYork,
      }),
    ).toStrictEqual([
      { translation: "New York", word: "Nova Iorque" },
      { translation: null, word: "tem" },
      { translation: null, word: "um" },
      { translation: null, word: "museu" },
      { translation: null, word: "novo." },
    ]);

    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "O museu novo fica em Nova Iorque",
        sentence: "The recently opened museum is in New York",
        vocabulary: newYork,
      }),
    ).toStrictEqual([
      { translation: null, word: "O" },
      { translation: null, word: "museu" },
      { translation: null, word: "novo" },
      { translation: null, word: "fica" },
      { translation: null, word: "em" },
      { translation: "New York", word: "Nova Iorque" },
    ]);
  });

  it("never matches a phrase across punctuation it doesn't have", () => {
    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "Eu disse a ela, cara, que vi o homem dela.",
        sentence: "I told her, man, that I saw her husband.",
        vocabulary: vocabulary([["her man", "o homem dela"]]),
      }).filter((promptWord) => promptWord.translation),
    ).toStrictEqual([]);

    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "Eu vi o homem, dela.",
        sentence: "I saw her man.",
        vocabulary: vocabulary([["her man", "o homem dela"]]),
      }).filter((promptWord) => promptWord.translation),
    ).toStrictEqual([]);

    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "As contas (água, luz e gás) estão incluídas?",
        sentence: "Are utilities included?",
        vocabulary: vocabulary([["utilities", "as contas (água, luz e gás)"]]),
      }).filter((promptWord) => promptWord.translation),
    ).toStrictEqual([{ translation: "utilities", word: "As contas (água, luz e gás)" }]);
  });

  it("lowercases each side as its language does", () => {
    expect(
      buildReadingPromptWords({
        languages: { language: "en", targetLanguage: "tr" },
        prompt: "The light is bright.",
        sentence: "Işık parlak.",
        vocabulary: vocabulary([["ışık", "light"]]),
      }),
    ).toStrictEqual([
      { translation: null, word: "The" },
      { translation: "Işık", word: "light" },
      { translation: null, word: "is" },
      { translation: null, word: "bright." },
    ]);

    expect(
      buildReadingPromptWords({
        languages: { language: "tr", targetLanguage: "en" },
        prompt: "Işık parlak.",
        sentence: "The light is bright.",
        vocabulary: vocabulary([["light", "ışık"]]),
      }),
    ).toStrictEqual([
      { translation: "light", word: "Işık" },
      { translation: null, word: "parlak." },
    ]);
  });

  it("drops the quotes around the whole prompt and keeps punctuation on its word", () => {
    expect(
      buildReadingPromptWords({
        ...pt,
        prompt: "“Oui , je suis là !”",
        sentence: "Yes, I am here!",
        vocabulary: vocabulary([
          ["yes", "oui"],
          ["here", "là"],
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
