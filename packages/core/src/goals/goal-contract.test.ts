import { getLanguageName } from "@zoonk/utils/languages";
import { describe, expect, it } from "vitest";
import { goalDraftSchema } from "./goal-contract";

function acceptsLanguage(language: string): boolean {
  return goalDraftSchema.safeParse({
    kind: "language",
    language,
    prompt: "Speak English",
    targetLanguage: language,
    title: "English",
  }).success;
}

describe("a goal draft's languages", () => {
  it("accepts only language codes a language name can be read from", () => {
    const valid = ["pt", "fil", "pt-BR", "PT-br", "zh-Hant", "es-419", "zh-Hans-CN"];

    expect(valid.filter((language) => acceptsLanguage(language))).toStrictEqual(valid);

    expect(() =>
      valid.map((language) =>
        getLanguageName({ targetLanguage: language, userLanguage: language }),
      ),
    ).not.toThrow();

    expect(
      ["x1a2b3c4d", "pt_BR", "p", "english", "en-a1", "zh-yue", " pt"].filter((language) =>
        acceptsLanguage(language),
      ),
    ).toStrictEqual([]);
  });
});
