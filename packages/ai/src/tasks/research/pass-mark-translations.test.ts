import { describe, expect, it } from "vitest";
import { toPassMarkTranslations } from "./pass-mark-translations";

const texts = [
  "Apto con un mínimo de 30 puntos en el Grupo 1 y 30 puntos en el Grupo 2.",
  "Calificación final: Apto o No apto.",
];

const LANGUAGES = ["en", "es", "pt"];

describe(toPassMarkTranslations, () => {
  it("keeps a translation per language other than the texts' own, with every line and number", () => {
    const pt = [
      "Aprovado («Apto») com no mínimo 30 pontos no Grupo 1 e 30 pontos no Grupo 2.",
      "Resultado final: Apto ou Não apto.",
    ];

    const translations = toPassMarkTranslations({
      languages: LANGUAGES,
      output: {
        language: "es",
        translations: [
          { language: "pt-BR", texts: pt },
          // Its own language isn't a translation, and a language nobody asked for isn't kept.
          { language: "es", texts },
          { language: "fr", texts: ["30 et 30.", "Apte ou non apte."] },
        ],
      },
      texts,
    });

    expect(translations).toStrictEqual({ pt });
  });

  it("leaves out a language that drops a line, changes a number or repeats one too few times", () => {
    const translations = toPassMarkTranslations({
      languages: LANGUAGES,
      output: {
        language: "es",
        translations: [
          { language: "en", texts: ["Pass with at least 30 points in Group 1 and 3 in Group 2."] },
          {
            language: "pt",
            texts: ["Aprovado com 30 pontos no Grupo 1 e no Grupo 2.", "Apto ou Não apto."],
          },
        ],
      },
      texts,
    });

    expect(translations).toStrictEqual({});
  });

  it("repairs an em dash instead of dropping the language", () => {
    const translations = toPassMarkTranslations({
      languages: LANGUAGES,
      output: {
        language: "es",
        translations: [
          {
            language: "en",
            texts: [
              "Pass — at least 30 points in Group 1 and 30 points in Group 2.",
              "Final grade: Pass or Fail.",
            ],
          },
        ],
      },
      texts,
    });

    expect(translations.en?.[0]).toBe(
      "Pass, at least 30 points in Group 1 and 30 points in Group 2.",
    );
  });
});
