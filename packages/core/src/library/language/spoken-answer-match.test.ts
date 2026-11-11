import { describe, expect, it } from "vitest";
import { matchSpokenAnswer, needsWordByWordCheck, pickWordsToExplain } from "./spoken-answer-match";

describe(matchSpokenAnswer, () => {
  it("accepts the sentence regardless of case and punctuation", () => {
    const match = matchSpokenAnswer({
      expected: "Is the apartment still available?",
      heard: "is the apartment still available",
      language: "en",
    });

    expect(match.isCorrect).toBe(true);
    expect(match.score).toBe(1);

    expect(match.words.map((word) => word.status)).toStrictEqual(
      Array.from({ length: 5 }, () => "correct"),
    );
  });

  it("lines a mispronounced word up with the word it replaced", () => {
    const match = matchSpokenAnswer({
      expected: "How much is the rent?",
      heard: "How much is the hent?",
      language: "en",
    });

    expect(match.isCorrect).toBe(false);
    expect(match.score).toBe(0.8);
    expect(match.words.at(-1)).toStrictEqual({ heard: "hent", status: "different", text: "rent?" });
  });

  it("marks words that weren't heard as missed", () => {
    const match = matchSpokenAnswer({
      expected: "Is the apartment still available?",
      heard: "Is the apartment available?",
      language: "en",
    });

    expect(match.words.find((word) => word.status !== "correct")).toStrictEqual({
      heard: null,
      status: "missed",
      text: "still",
    });
  });

  it("treats English contractions and their long forms as the same words", () => {
    const match = matchSpokenAnswer({
      expected: "I've lived here since 2020.",
      heard: "I have lived here since 2020",
      language: "en",
    });

    expect(match.isCorrect).toBe(true);
  });

  it("accepts an 's or 'd contraction said in full, in either of its long forms", () => {
    const pairs = [
      ["What's your phone number?", "What is your phone number?"],
      ["She's been here before.", "She has been here before."],
      ["I'd like a coffee.", "I would like a coffee."],
      ["We'd already left.", "We had already left."],
      ["What is your name?", "What's your name?"],
      ["She's here and she is happy.", "She is here and she is happy."],
      ["She is here and she's happy.", "She's here and she's happy."],
    ];

    for (const [expected = "", heard = ""] of pairs) {
      expect(matchSpokenAnswer({ expected, heard, language: "en" }).isCorrect).toBe(true);
    }
  });

  it("still flags another word in place of an 's contraction", () => {
    const match = matchSpokenAnswer({
      expected: "What's your name?",
      heard: "What was your name?",
      language: "en",
    });

    expect(match.words[0]).toStrictEqual({ heard: "what", status: "different", text: "What's" });
  });

  it("shows what was heard of a word that was only partly said", () => {
    const match = matchSpokenAnswer({
      expected: "I've lived here since 2020.",
      heard: "I live here since 2020",
      language: "en",
    });

    expect(match.words.slice(0, 2)).toStrictEqual([
      { heard: "i", status: "different", text: "I've" },
      { heard: "live", status: "different", text: "lived" },
    ]);
  });

  it("keeps accents, because they change words", () => {
    const match = matchSpokenAnswer({
      expected: "O apartamento ainda está disponível?",
      heard: "O apartamento ainda esta disponível",
      language: "pt",
    });

    expect(match.words[3]).toStrictEqual({ heard: "esta", status: "different", text: "está" });
  });

  it("doesn't fail an answer for extra filler words", () => {
    const match = matchSpokenAnswer({
      expected: "¿Cuánto cuesta el alquiler?",
      heard: "Eh, ¿cuánto cuesta el alquiler?",
      language: "es",
    });

    expect(match.isCorrect).toBe(true);
    expect(match.normalizedHeard).toBe("eh cuánto cuesta el alquiler");
  });

  it("gives no credit when nothing was heard", () => {
    const match = matchSpokenAnswer({ expected: "Good morning", heard: "", language: "en" });

    expect(match.isCorrect).toBe(false);
    expect(match.score).toBe(0);
    expect(match.words.every((word) => word.status === "missed")).toBe(true);
  });

  it("accepts Chinese heard in traditional characters for a sentence written in simplified ones", () => {
    const match = matchSpokenAnswer({
      expected: "请问，最近的地铁站在哪里？",
      heard: "請問最近的地鐵站在哪裡？",
      language: "zh",
    });

    expect(match.isCorrect).toBe(true);
  });

  it("still flags a different Chinese word, showing what was heard without spaces", () => {
    const match = matchSpokenAnswer({
      expected: "请问，最近的地铁站在哪里？",
      heard: "请问，最近的图书馆在哪里？",
      language: "zh",
    });

    expect(match.isCorrect).toBe(false);
    expect(match.words[0]?.heard).toBe("请问最近的图书馆在哪里");
  });

  it("accepts Cantonese heard in simplified characters for a sentence written in traditional ones", () => {
    const match = matchSpokenAnswer({
      expected: "唔該，請問地鐵站喺邊度？",
      heard: "唔该请问地铁站喺边度",
      language: "yue",
    });

    expect(match.isCorrect).toBe(true);
  });

  it("doesn't fail Japanese for a comma the transcript left out", () => {
    const match = matchSpokenAnswer({
      expected: "先週、友達と京都に行きました。",
      heard: "先週友達と京都に行きました",
      language: "ja",
    });

    expect(match.isCorrect).toBe(true);
  });

  it("compares Turkish in Turkish casing", () => {
    const match = matchSpokenAnswer({
      expected: "Işıklar İzmir'de yanıyor.",
      heard: "ışıklar izmir'de yanıyor",
      language: "tr",
    });

    expect(match.isCorrect).toBe(true);
  });

  it("reads letters joined by hyphens as the letters spelled out", () => {
    const match = matchSpokenAnswer({
      expected: "My name is Emma, E-M-M-A.",
      heard: "My name is Emma. E, M, M, A.",
      language: "en",
    });

    expect(match.isCorrect).toBe(true);
  });

  it("reads digit groups joined by hyphens as the same digits written apart", () => {
    const match = matchSpokenAnswer({
      expected: "My phone number is 234-555-0123",
      heard: "My phone number is 234 555 0123.",
      language: "en",
    });

    expect(match.isCorrect).toBe(true);
  });
});

function needsListening({
  expected,
  heard,
  language,
}: {
  expected: string;
  heard: string;
  language: string;
}) {
  const { words } = matchSpokenAnswer({ expected, heard, language });
  return needsWordByWordCheck({ language, words });
}

describe(needsWordByWordCheck, () => {
  it("finds letter names the transcript wrote as bare letters", () => {
    expect(
      needsListening({
        expected: "Emma si scrive: e, emme, emme, a",
        heard: "Emma si scrive E, M, M, A.",
        language: "it",
      }),
    ).toBe(true);

    expect(
      needsListening({
        expected: "Wes is spelled double-u, e, s",
        heard: "Wes is spelled W-E-S.",
        language: "en",
      }),
    ).toBe(true);
  });

  it("finds a letter whose name is two words, one of them a letter", () => {
    expect(
      needsListening({
        expected: "Wes is spelled double u, e, s",
        heard: "Wes is spelled W-E-S.",
        language: "en",
      }),
    ).toBe(true);

    expect(
      needsListening({
        expected: "Wendy se escribe: uve doble, e, ene, de, i griega",
        heard: "Wendy se escribe W, E, N, D, Y.",
        language: "es",
      }),
    ).toBe(true);

    expect(
      needsListening({
        expected: "Yago se escribe: i griega, a, ge, o",
        heard: "Yago se escribe Y, A, G, O.",
        language: "es",
      }),
    ).toBe(true);
  });

  it("finds a letter name next to another mistake", () => {
    expect(
      needsListening({
        expected: "Il codice è emme uno",
        heard: "Il codice è M 1",
        language: "it",
      }),
    ).toBe(true);

    expect(
      needsListening({
        expected: "The code is one double u",
        heard: "The code is 1 W",
        language: "en",
      }),
    ).toBe(true);
  });

  it("finds a number the transcript wrote differently from the sentence", () => {
    expect(
      needsListening({
        expected: "My phone number is 234-555-0123",
        heard: "My phone number is two three four five five five one, zero one two three.",
        language: "en",
      }),
    ).toBe(true);

    expect(
      needsListening({
        expected: "Did you say 312?",
        heard: "Did you say three one two?",
        language: "en",
      }),
    ).toBe(true);

    expect(
      needsListening({
        expected: "I have three brothers.",
        heard: "I have 3 brothers.",
        language: "en",
      }),
    ).toBe(true);

    expect(needsListening({ expected: "我有三个哥哥", heard: "我有3个哥哥", language: "zh" })).toBe(
      true,
    );
  });

  it("leaves a mistake beside a number heard right to the transcript", () => {
    expect(needsListening({ expected: "我有3个哥哥", heard: "我有3个姐姐", language: "zh" })).toBe(
      false,
    );
  });

  it("leaves letters to the transcript when the sentence writes them as letters", () => {
    expect(
      needsListening({
        expected: "Emma si scrive: E, M, M, A",
        heard: "Emma si scrive E, N, M, A.",
        language: "it",
      }),
    ).toBe(false);
  });

  it("leaves ordinary mistakes to the transcript", () => {
    expect(
      needsListening({
        expected: "How much is the rent?",
        heard: "How much is the hent?",
        language: "en",
      }),
    ).toBe(false);
  });

  it("doesn't take a Chinese character heard for a word as a letter", () => {
    expect(needsListening({ expected: "你好", heard: "你", language: "zh" })).toBe(false);
  });
});

describe(pickWordsToExplain, () => {
  it("explains at most two words, words heard differently first", () => {
    const words = matchSpokenAnswer({
      expected: "The apartment has two big bedrooms",
      heard: "The apartament has tree bedrooms",
      language: "en",
    }).words;

    expect(pickWordsToExplain(words).map((word) => word.text)).toStrictEqual(["apartment", "two"]);
  });
});
