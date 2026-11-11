import { describe, expect, it } from "vitest";
import { findLanguageFlaws } from "./language-flaws";

describe(findLanguageFlaws, () => {
  it("finds a word in an alphabet neither language uses", () => {
    const value = {
      evidence:
        "Você avalia as opções com equilíbrio e interage com есте naturalidade nas perguntas, como em “Por un lado, me parece bien”.",
    };

    expect(
      findLanguageFlaws({ input: "", language: "pt", otherLanguages: ["es"], value }),
    ).toStrictEqual([expect.stringContaining('"есте"')]);
  });

  it("finds Portuguese written without its accents", () => {
    const value = {
      situation: "Este e um simulado pratico da secao de fala, nao um teste oficial.",
      title: "Simulado Pratico da Secao de Fala do TOEFL",
    };

    expect(findLanguageFlaws({ input: "", language: "pt", value })).toStrictEqual([
      expect.stringContaining('"secao"'),
      expect.stringContaining('"nao"'),
      expect.stringContaining('"Secao"'),
    ]);
  });

  it("finds accentless words in each language that writes accents", () => {
    const cases = [
      { language: "es", text: "Tu pronunciacion mejoro mucho, y tambien la fluidez." },
      { language: "fr", text: "Ta reponse est claire, mais la deuxieme partie manque." },
      { language: "de", text: "Du kannst das spater nochmal uben." },
      { language: "it", text: "Puoi parlare piu lentamente perche è chiaro." },
      { language: "tr", text: "Bu cümle icin dogru zamanı seç." },
      { language: "pl", text: "Sprobuj powiedzieć to wiecej razy." },
    ];

    const counts = cases.map(
      ({ language, text }) =>
        findLanguageFlaws({ input: "", language, value: { feedback: text } }).length,
    );

    expect(counts).toStrictEqual(cases.map(() => 2));
  });

  it("passes the practiced language's script, symbols and correctly spelled text", () => {
    const value = {
      feedback:
        "Você disse 「こんにちは」 bem, e acertou ありがとう. A área é π r², com Δx pequeno.",
      tip: "Também diga すみません antes de perguntar.",
    };

    expect(
      findLanguageFlaws({ input: "", language: "pt-BR", otherLanguages: ["ja"], value }),
    ).toStrictEqual([]);
  });

  it("passes words spelled as the input wrote them, quoted, in code or in a placeholder", () => {
    const value = {
      feedback:
        "Você escreveu “nao entendi”; tente `nao_entendi` com {producao} e Sergei (Сергей).",
      said: "desculpa, nao entendi o deposito, voce pode repetir?",
    };

    expect(
      findLanguageFlaws({
        input: "LEARNER: desculpa, nao entendi o deposito, voce pode repetir?",
        language: "pt",
        value,
      }),
    ).toStrictEqual([]);
  });

  it("passes an alphabet the input is written in, such as a question about Japanese", () => {
    const value = { explanation: "Aqui o verbo vai para a forma て: 食べて, não 食べた." };

    expect(
      findLanguageFlaws({ input: "QUESTION: Complete: 食べ___ください", language: "pt", value }),
    ).toStrictEqual([]);
  });

  it("finds a Greek word, though a Greek letter alone is a symbol", () => {
    const value = "Você respondeu με φυσικά naturalidade, e ω = Δθ/Δt ficou pequeno.";

    expect(findLanguageFlaws({ input: "", language: "pt", value })).toStrictEqual([
      expect.stringContaining('"με"'),
      expect.stringContaining('"φυσικά"'),
    ]);
  });

  it("finds a one-word title and bracketed prose without accents", () => {
    const value = { feedback: "Continue praticando (voce esta evoluindo).", title: "Comunicacao" };

    expect(findLanguageFlaws({ input: "", language: "pt", value })).toStrictEqual([
      expect.stringContaining('"voce"'),
      expect.stringContaining('"Comunicacao"'),
    ]);
  });

  it("passes only the form the learner typed, not the model's own", () => {
    const value = { feedback: "Voce nao identificou a causa." };

    expect(
      findLanguageFlaws({ input: "nao entendi, voce pode explicar?", language: "pt", value }),
    ).toStrictEqual([expect.stringContaining('"Voce"')]);
  });

  it("passes practiced-language words that look like accentless ones", () => {
    expect(
      findLanguageFlaws({
        input: "LEARNER_ANSWER: Alza la vose.",
        language: "pt",
        otherLanguages: ["it"],
        value: { spelling: "Alza la voce." },
      }),
    ).toStrictEqual([]);

    expect(
      findLanguageFlaws({
        input: "LEARNER_ANSWER: Vose alta.",
        language: "pt",
        otherLanguages: ["it"],
        value: { feedback: "Troque o s por c.", spelling: "Voce alta." },
      }),
    ).toStrictEqual([]);

    expect(
      findLanguageFlaws({
        input: "LEARNER_ANSWER: I have a suspision.",
        language: "es",
        otherLanguages: ["en"],
        value: { spelling: "Suspicion. I have a suspicion." },
      }),
    ).toStrictEqual([]);
  });

  it("passes keys, slugs and one-word ids, which are no prose", () => {
    const value = {
      id: "comunicacao",
      key: "regra-de-tres",
      url: "https://example.com/Comunicacao",
    };

    expect(findLanguageFlaws({ input: "", language: "pt", value })).toStrictEqual([]);
  });

  it("leaves accentless words that are real words in a language practiced beside it", () => {
    const value = { text: "Ya sé quién llama cuando el patio se llena de voces. Er mochte das." };

    expect(
      findLanguageFlaws({ input: "", language: "pt", otherLanguages: ["es"], value }),
    ).toStrictEqual([]);

    expect(
      findLanguageFlaws({ input: "", language: "de", otherLanguages: ["en"], value }),
    ).toStrictEqual([]);
  });
});
