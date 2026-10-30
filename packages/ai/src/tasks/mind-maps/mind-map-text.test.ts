import { describe, expect, it } from "vitest";
import { type MindMapStructure, listMindMapTexts } from "./mind-map-schema";
import { compareMindMapText } from "./mind-map-text";

const structure: MindMapStructure = {
  branches: [
    {
      drawing: "a solar panel",
      explanation: "Recebe luz do sol e fornece eletricidade.",
      points: ["Liga-se à fiação da casa", "Não entrega água quente"],
      title: "Painel fotovoltaico",
    },
    {
      drawing: "an inverter box",
      explanation: "Adapta a corrente contínua para a instalação.",
      points: ["Instalação usa corrente alternada"],
      title: "Inversor",
    },
    {
      drawing: "an electric meter",
      explanation: "Registra a eletricidade que passa.",
      points: ["Fica na ligação com a rede"],
      title: "Medidor",
    },
  ],
  centralIdea: "A luz do sol vira eletricidade usada na edificação.",
  comparison: null,
  summary: "O painel capta a luz e o inversor adapta a corrente.",
  title: "Da luz à eletricidade",
};

const expected = listMindMapTexts({ language: "pt", structure });

describe(compareMindMapText, () => {
  it("passes a picture whose words are the map's, whatever the case, lines and bullets", () => {
    const transcript = [
      "DA LUZ À ELETRICIDADE",
      "Ideia central",
      "A luz do sol vira eletricidade",
      "usada na edificação.",
      "1. Painel fotovoltaico",
      "Recebe luz do sol e fornece eletricidade.",
      "• Liga-se à fiação da casa",
      "• Não entrega água quente",
      "2. Inversor",
      "Adapta a corrente contínua para a instalação.",
      "Instalação usa corrente alternada",
      "3. Medidor",
      "Registra a eletricidade que passa.",
      "Fica na ligação com a rede",
      "Resumo: O painel capta a luz e o inversor adapta a corrente.",
    ];

    expect(compareMindMapText({ expected, transcript })).toStrictEqual({
      missing: [],
      passed: true,
      unknown: [],
    });
  });

  it("lets a slip or two through: a swapped letter and a word on a sketch", () => {
    const transcript = [
      ...expected.filter((text) => !text.startsWith("Instalação")),
      "Instalação usa corrente aletrnada",
      "VIP",
    ];

    expect(compareMindMapText({ expected, transcript })).toStrictEqual({
      missing: ["alternada"],
      passed: true,
      unknown: ["aletrnada", "vip"],
    });
  });

  it("fails several wrong words: a misspelling, a missing accent and a sketch's caption", () => {
    const transcript = [
      ...expected.filter((text) => !text.startsWith("Instalação")),
      "Instalação usa corrente altenpada",
      "Recebe luz do sol e fornece eletrica",
      "Subscriber",
    ];

    const result = compareMindMapText({ expected, transcript });

    expect(result.passed).toBe(false);
    expect(result.unknown).toStrictEqual(["altenpada", "eletrica", "subscriber"]);
  });

  it("counts a word broken across two lines and ignores a sketch's dial and stray marks", () => {
    const transcript = [
      ...expected.filter((text) => !text.startsWith("Recebe")),
      "Recebe luz do sol e fornece eletrici",
      "dade.",
      "000123",
      "x",
    ];

    expect(compareMindMapText({ expected, transcript }).passed).toBe(true);
  });

  it("fails a picture that leaves out a branch", () => {
    const transcript = expected.filter(
      (text) => !["3. Medidor", "Registra a eletricidade que passa."].includes(text),
    );

    const result = compareMindMapText({ expected, transcript });

    expect(result.passed).toBe(false);
    expect(result.missing).toStrictEqual(["medidor", "registra", "que", "passa"]);
  });
});
