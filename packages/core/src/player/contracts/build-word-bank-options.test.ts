import { shuffle } from "@zoonk/utils/shuffle";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildFillBlankOptions,
  buildSentenceWordOptions,
  buildWordBankOptions,
  listTargetBankWords,
} from "./build-word-bank-options";
import { type SerializedStep, type SerializedWord } from "./prepare-lesson-data";
import { type DistractorWord } from "./translation-options";

type SerializedSentence = NonNullable<SerializedStep["sentence"]>;

const LANGUAGES = { language: "pt", targetLanguage: "de" };

function keepOrder() {
  vi.mocked(shuffle).mockImplementation((items) => [...items]);
}

function makeLessonWord(overrides: Partial<SerializedWord> = {}): SerializedWord {
  return {
    audioUrl: null,
    distractors: [],
    id: "lesson-word",
    pronunciation: null,
    romanization: null,
    translation: "translation",
    word: "word",
    ...overrides,
  };
}

function makeSentence(overrides: Partial<SerializedSentence> = {}): SerializedSentence {
  return {
    audioUrl: null,
    distractors: [],
    explanation: null,
    id: "sentence-1",
    romanization: null,
    sentence: "Guten Morgen, Anna!",
    translation: "Bom dia, Anna!",
    translationDistractors: [],
    ...overrides,
  };
}

function makeStep(
  kind: "reading" | "listening",
  sentence: SerializedSentence,
): SerializedStep<"reading" | "listening"> {
  return {
    content: {},
    fillBlankOptions: [],
    id: `step-${kind}`,
    kind,
    matchColumnsRightItems: [],
    position: 0,
    readingPromptWords: [],
    sentence,
    sentenceWordOptions: [],
    translationOptions: [],
    vocabularyOptions: [],
    word: null,
    wordBankOptions: [],
  };
}

function makeDistractorWord(overrides: Partial<DistractorWord> = {}): DistractorWord {
  return { audioUrl: null, id: "distractor-1", romanization: null, word: "word", ...overrides };
}

describe(buildWordBankOptions, () => {
  beforeEach(keepOrder);

  it("reading uses stored distractors only and removes phrases plus canonical collisions", () => {
    const options = buildWordBankOptions(
      makeStep(
        "reading",
        makeSentence({
          distractors: ["Abend", "Guten", "Guten Tag", "Fenster"],
          sentence: "Guten Morgen, Anna!",
        }),
      ),
      [],
      [],
      new Map(),
      LANGUAGES,
    );

    expect(options.map((option) => option.word)).toStrictEqual([
      "Guten",
      "Morgen,",
      "Anna!",
      "Abend",
      "Fenster",
    ]);
  });

  it("reading hydrates target-language distractors with metadata", () => {
    const options = buildWordBankOptions(
      makeStep("reading", makeSentence({ distractors: ["犬"], sentence: "猫です" })),
      [],
      [
        makeDistractorWord({
          audioUrl: "/audio/dog.mp3",
          id: "dog-1",
          romanization: "inu",
          word: "犬",
        }),
      ],
      new Map(),
      LANGUAGES,
    );

    expect(options.find((option) => option.word === "犬")).toStrictEqual({
      audioUrl: "/audio/dog.mp3",
      romanization: "inu",
      translation: null,
      word: "犬",
    });
  });

  it("plays each word of a phrase the lesson teaches with its own audio, never the phrase's empty split", () => {
    const options = buildWordBankOptions(
      makeStep("reading", makeSentence({ sentence: "Das ist der rote Faden" })),
      [
        makeLessonWord({ audioUrl: "/audio/rote.mp3", id: "rote", word: "rote" }),
        makeLessonWord({ audioUrl: "/audio/phrase.mp3", id: "phrase", word: "der rote Faden" }),
      ],
      ["Das", "ist", "der", "Faden"].map((word) =>
        makeDistractorWord({ audioUrl: `/audio/${word}.mp3`, id: word, word }),
      ),
      new Map(),
      LANGUAGES,
    );

    expect(options.map((option) => [option.word, option.audioUrl])).toStrictEqual([
      ["Das", "/audio/Das.mp3"],
      ["ist", "/audio/ist.mp3"],
      ["der", "/audio/der.mp3"],
      ["rote", "/audio/rote.mp3"],
      ["Faden", "/audio/Faden.mp3"],
    ]);
  });

  it("listening uses translation distractors and keeps metadata empty", () => {
    const options = buildWordBankOptions(
      makeStep(
        "listening",
        makeSentence({
          sentence: "Guten Tag, Lara.",
          translation: "Boa tarde, Lara.",
          translationDistractors: ["Bom", "noite", "cedo demais"],
        }),
      ),
      [
        makeLessonWord({
          audioUrl: "/audio/bom.mp3",
          romanization: "bom",
          translation: "good",
          word: "Bom",
        }),
      ],
      [makeDistractorWord({ audioUrl: "/audio/noite.mp3", romanization: "noite", word: "noite" })],
      new Map(),
      LANGUAGES,
    );

    expect(options.map((option) => option.word)).toStrictEqual([
      "Boa",
      "tarde,",
      "Lara.",
      "Bom",
      "noite",
    ]);

    expect(options.find((option) => option.word === "noite")).toStrictEqual({
      audioUrl: null,
      romanization: null,
      translation: null,
      word: "noite",
    });
  });

  it("limits reading word banks to four distractors", () => {
    const options = buildWordBankOptions(
      makeStep(
        "reading",
        makeSentence({
          distractors: ["uno", "dos", "tres", "cuatro", "cinco"],
          sentence: "Hola mundo",
        }),
      ),
      [],
      [],
      new Map(),
      LANGUAGES,
    );

    expect(options.map((option) => option.word)).toStrictEqual([
      "Hola",
      "mundo",
      "uno",
      "dos",
      "tres",
      "cuatro",
    ]);
  });

  it("shuffles reading distractors before applying the visible cap", () => {
    vi.mocked(shuffle)
      .mockImplementationOnce((items: readonly unknown[]) => [...items].toReversed())
      .mockImplementationOnce((items: readonly unknown[]) => [...items]);

    const options = buildWordBankOptions(
      makeStep(
        "reading",
        makeSentence({
          distractors: ["uno", "dos", "tres", "cuatro", "cinco"],
          sentence: "Hola mundo",
        }),
      ),
      [],
      [],
      new Map(),
      LANGUAGES,
    );

    expect(options.map((option) => option.word)).toStrictEqual([
      "Hola",
      "mundo",
      "cinco",
      "cuatro",
      "tres",
      "dos",
    ]);
  });

  it("keeps a listening distractor's capital when its spelling or the sentence start needs it", () => {
    const options = buildWordBankOptions(
      makeStep(
        "listening",
        makeSentence({
          sentence: "Quanto custa o aluguel?",
          translation: "How much is the rent?",
          translationDistractors: ["When", "I", "are"],
        }),
      ),
      [],
      [],
      new Map(),
      { language: "en", targetLanguage: "pt" },
    );

    expect(options.map((option) => option.word)).toStrictEqual([
      "How",
      "much",
      "is",
      "the",
      "rent?",
      "When",
      "I",
      "are",
    ]);
  });

  it.each([
    { distractors: ["Sie", "Hund", "kommen"], sentence: "Kommst du aus Berlin?" },
    { distractors: ["Du", "hast", "Katze"], sentence: "Ich habe einen Hund" },
  ])("shows German distractors for $sentence as they are spelled", ({ distractors, sentence }) => {
    const options = buildWordBankOptions(
      makeStep("reading", makeSentence({ distractors, sentence })),
      [],
      [],
      new Map(),
      LANGUAGES,
    );

    expect(options.map((option) => option.word).slice(-distractors.length)).toStrictEqual(
      distractors,
    );
  });

  it("splits a Japanese translation into phrases a learner can arrange", () => {
    const options = buildWordBankOptions(
      makeStep(
        "listening",
        makeSentence({
          sentence: "I drink coffee every morning.",
          translation: "毎朝コーヒーを飲みます。",
          translationDistractors: ["紅茶を", "飲みました"],
        }),
      ),
      [],
      [],
      new Map(),
      { language: "ja", targetLanguage: "en" },
    );

    expect(options.map((option) => option.word)).toStrictEqual([
      "毎朝",
      "コーヒーを",
      "飲みます。",
      "紅茶を",
      "飲みました",
    ]);
  });

  it("shows Turkish distractors with their own dotted and dotless i", () => {
    const options = buildWordBankOptions(
      makeStep(
        "listening",
        makeSentence({
          sentence: "Good morning.",
          translation: "Günaydın.",
          translationDistractors: ["ışık", "İyi"],
        }),
      ),
      [],
      [],
      new Map(),
      { language: "tr", targetLanguage: "en" },
    );

    expect(options.map((option) => option.word)).toStrictEqual(["Günaydın.", "ışık", "İyi"]);
  });

  it("drops a distractor that is a sentence word in its language's casing", () => {
    const options = buildWordBankOptions(
      makeStep(
        "listening",
        makeSentence({
          sentence: "The light is here.",
          translation: "Işık burada.",
          translationDistractors: ["ışık", "orada"],
        }),
      ),
      [],
      [],
      new Map(),
      { language: "tr", targetLanguage: "en" },
    );

    expect(options.map((option) => option.word)).toStrictEqual(["Işık", "burada.", "orada"]);
  });

  it("shows fewer distractors when sanitation removes entries", () => {
    const options = buildWordBankOptions(
      makeStep("reading", makeSentence({ distractors: ["Hola", "Salut"], sentence: "Hola mundo" })),
      [],
      [],
      new Map(),
      LANGUAGES,
    );

    expect(options.map((option) => option.word)).toStrictEqual(["Hola", "mundo", "Salut"]);
  });
});

describe(buildSentenceWordOptions, () => {
  beforeEach(keepOrder);

  it("hydrates multi-word lesson entries token by token", () => {
    const options = buildSentenceWordOptions({
      distractorWords: [],
      language: "ja",
      lessonWords: [
        makeLessonWord({ romanization: "ohayou gozaimasu", word: "おはよう ございます" }),
      ],
      sentence: "おはよう ございます",
      sentenceWordMap: new Map(),
    });

    expect(options).toStrictEqual([
      { audioUrl: null, romanization: "ohayou", translation: null, word: "おはよう" },
      { audioUrl: null, romanization: "gozaimasu", translation: null, word: "ございます" },
    ]);
  });

  it("shows no romanization or respelling under a word already in Latin letters", () => {
    const options = buildSentenceWordOptions({
      distractorWords: [],
      language: "de",
      lessonWords: [
        makeLessonWord({
          pronunciation: "GOO-ten",
          romanization: "guten morgen",
          word: "Guten Morgen",
        }),
      ],
      sentence: "Guten Morgen",
      sentenceWordMap: new Map(),
    });

    expect(options).toStrictEqual([
      { audioUrl: null, romanization: null, translation: null, word: "Guten" },
      { audioUrl: null, romanization: null, translation: null, word: "Morgen" },
    ]);
  });

  it("keeps lesson-word translations when sentence metadata adds audio and romanization", () => {
    const options = buildSentenceWordOptions({
      distractorWords: [],
      language: "ru",
      lessonWords: [
        makeLessonWord({
          audioUrl: "/audio/privet.mp3",
          romanization: null,
          translation: "hello",
          word: "Привет",
        }),
      ],
      sentence: "Привет",
      sentenceWordMap: new Map([
        [
          "привет",
          {
            audioUrl: "/audio/privet-sentence.mp3",
            romanization: "privet",
            translation: "hello from sentence",
            word: "Привет",
          },
        ],
      ]),
    });

    expect(options).toStrictEqual([
      {
        audioUrl: "/audio/privet-sentence.mp3",
        romanization: "privet",
        translation: "hello",
        word: "Привет",
      },
    ]);
  });

  it("uses sentence word translations when lesson words do not provide one", () => {
    const options = buildSentenceWordOptions({
      distractorWords: [],
      language: "ru",
      lessonWords: [],
      sentence: "Привет",
      sentenceWordMap: new Map([
        [
          "привет",
          {
            audioUrl: "/audio/privet-sentence.mp3",
            romanization: "privet",
            translation: "hello",
            word: "Привет",
          },
        ],
      ]),
    });

    expect(options).toStrictEqual([
      {
        audioUrl: "/audio/privet-sentence.mp3",
        romanization: "privet",
        translation: "hello",
        word: "Привет",
      },
    ]);
  });
});

describe(listTargetBankWords, () => {
  it("lists the words reading and fill-in-the-blank tiles show, without the punctuation around them", () => {
    const words = listTargetBankWords({
      sentences: new Map([
        ["read", { distractors: ["Agua", "dónde estás"], sentence: "¿Dónde está el baño?" }],
        ["heard", { distractors: ["onde"], sentence: "Onde fica o banheiro?" }],
      ]),
      steps: [
        { content: {}, kind: "reading", sentenceId: "read" },
        {
          content: {
            answers: ["l'eau"],
            distractors: ["le eau", "de l'eau"],
            feedback: "Eau commence par une voyelle.",
            template: "Je bois [BLANK].",
          },
          kind: "fillBlank",
          sentenceId: null,
        },
        { content: {}, kind: "listening", sentenceId: "heard" },
      ],
    });

    expect(words).toStrictEqual([
      "Dónde",
      "está",
      "el",
      "baño",
      "Agua",
      "l'eau",
      "le eau",
      "de l'eau",
    ]);
  });

  it("lists German bank words in the case their tiles show", () => {
    const words = listTargetBankWords({
      sentences: new Map([
        ["read", { distractors: ["Sie", "Hund"], sentence: "Kommst du aus Berlin?" }],
      ]),
      steps: [{ content: {}, kind: "reading", sentenceId: "read" }],
    });

    expect(words).toStrictEqual(["Kommst", "du", "aus", "Berlin", "Sie", "Hund"]);
  });

  it.each([
    { distractors: [], language: "es", sentence: "¿Dónde está el baño?" },
    { distractors: [], language: "en", sentence: "We're sure they were here" },
    { distractors: [], language: "fr", sentence: "Je bois de l'eau, merci !" },
    { distractors: [], language: "ja", sentence: "駅はどこですか？" },
    { distractors: [], language: "ko", sentence: "학교에 가요." },
    { distractors: [], language: "hi", sentence: "मुझे काम कम है।" },
    { distractors: [], language: "th", sentence: "ผมชอบกินข้าวมาก" },
    { distractors: ["Işıklar"], language: "tr", sentence: "Işık yanıyor" },
  ])(
    "gives each $language reading tile the audio saved for its own word",
    ({ distractors, language, sentence }) => {
      keepOrder();
      const read = makeSentence({ distractors, sentence });
      const step = makeStep("reading", read);

      const words = listTargetBankWords({
        sentences: new Map([[read.id, read]]),
        steps: [{ ...step, sentenceId: read.id }],
      });

      const saved = words.map((word, index) =>
        makeDistractorWord({ audioUrl: `/audio/${index}.mp3`, id: String(index), word }),
      );

      const options = buildWordBankOptions(step, [], saved, new Map(), {
        language: "pt",
        targetLanguage: language,
      });

      expect(options.map((option) => option.audioUrl)).toStrictEqual(
        saved.map((word) => word.audioUrl),
      );
    },
  );
});

describe(buildFillBlankOptions, () => {
  beforeEach(keepOrder);

  it("gives each tile its word's audio, and the step's own romanization first", () => {
    const step: SerializedStep = {
      ...makeStep("reading", makeSentence()),
      content: {
        answers: ["食べます"],
        distractors: ["飲みます"],
        feedback: "パンは食べるものです。",
        romanizations: { 飲みます: "nomimasu" },
        template: "パンを[BLANK]",
      },
      kind: "fillBlank",
      sentence: null,
    };

    const options = buildFillBlankOptions({
      distractorWords: [
        makeDistractorWord({
          audioUrl: "/audio/taberu.mp3",
          romanization: "tabemasu",
          word: "食べます",
        }),
        makeDistractorWord({
          audioUrl: "/audio/nomu.mp3",
          id: "2",
          romanization: "nomu",
          word: "飲みます",
        }),
      ],
      language: "ja",
      lessonWords: [],
      sentenceWordMap: new Map(),
      step,
    });

    expect(options).toStrictEqual([
      {
        audioUrl: "/audio/taberu.mp3",
        romanization: "tabemasu",
        translation: null,
        word: "食べます",
      },
      {
        audioUrl: "/audio/nomu.mp3",
        romanization: "nomimasu",
        translation: null,
        word: "飲みます",
      },
    ]);
  });
});
