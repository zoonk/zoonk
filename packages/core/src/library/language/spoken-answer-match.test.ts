import { describe, expect, it } from "vitest";
import {
  hasTranscribedLetterNames,
  matchSpokenAnswer,
  pickWordsToExplain,
} from "./spoken-answer-match";

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
});

function hasLetterNames({
  expected,
  heard,
  language,
}: {
  expected: string;
  heard: string;
  language: string;
}) {
  const { words } = matchSpokenAnswer({ expected, heard, language });
  return hasTranscribedLetterNames({ language, words });
}

describe(hasTranscribedLetterNames, () => {
  it("finds letter names the transcript wrote as bare letters", () => {
    expect(
      hasLetterNames({
        expected: "Emma si scrive: e, emme, emme, a",
        heard: "Emma si scrive E, M, M, A.",
        language: "it",
      }),
    ).toBe(true);

    expect(
      hasLetterNames({
        expected: "Wes is spelled double-u, e, s",
        heard: "Wes is spelled W-E-S.",
        language: "en",
      }),
    ).toBe(true);
  });

  it("finds a letter whose name is two words, one of them a letter", () => {
    expect(
      hasLetterNames({
        expected: "Wes is spelled double u, e, s",
        heard: "Wes is spelled W-E-S.",
        language: "en",
      }),
    ).toBe(true);

    expect(
      hasLetterNames({
        expected: "Wendy se escribe: uve doble, e, ene, de, i griega",
        heard: "Wendy se escribe W, E, N, D, Y.",
        language: "es",
      }),
    ).toBe(true);

    expect(
      hasLetterNames({
        expected: "Yago se escribe: i griega, a, ge, o",
        heard: "Yago se escribe Y, A, G, O.",
        language: "es",
      }),
    ).toBe(true);
  });

  it("finds a letter name next to another mistake", () => {
    expect(
      hasLetterNames({
        expected: "Il codice è emme uno",
        heard: "Il codice è M 1",
        language: "it",
      }),
    ).toBe(true);
  });

  it("leaves letters to the transcript when the sentence writes them as letters", () => {
    expect(
      hasLetterNames({
        expected: "Emma si scrive: E, M, M, A",
        heard: "Emma si scrive E, N, M, A.",
        language: "it",
      }),
    ).toBe(false);
  });

  it("leaves ordinary mistakes to the transcript", () => {
    expect(
      hasLetterNames({
        expected: "How much is the rent?",
        heard: "How much is the hent?",
        language: "en",
      }),
    ).toBe(false);
  });

  it("doesn't take a Chinese character heard for a word as a letter", () => {
    expect(hasLetterNames({ expected: "你好", heard: "你", language: "zh" })).toBe(false);
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
