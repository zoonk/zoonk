import { describe, expect, it } from "vitest";
import { matchSpokenAnswer, pickWordsToExplain } from "./spoken-answer-match";

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
