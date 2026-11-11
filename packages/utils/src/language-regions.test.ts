import { describe, expect, it } from "vitest";
import {
  getLanguageRegions,
  getRegionChoices,
  getTaughtRegion,
  getVarietyFlagCode,
  getVarietyName,
  isLanguageRegion,
  splitTargetLanguage,
} from "./language-regions";

describe(splitTargetLanguage, () => {
  it.each([
    ["es", "es", null],
    ["es-ES", "es", "ES"],
    ["es-MX", "es", "MX"],
    ["ES-ar", "es", "AR"],
    ["es-419", "es", null],
    ["es-JP", "es", null],
    ["es-Latn-AR", "es", "AR"],
    ["pt-PT", "pt", "PT"],
    ["pt-BR", "pt", "BR"],
    ["en-GB", "en", "GB"],
    ["en-001", "en", null],
    ["fr-CA", "fr", "CA"],
    ["de-AT", "de", "AT"],
    ["spa", "es", null],
  ])("reads %s as %s with country %s", (tag, targetLanguage, targetRegion) => {
    expect(splitTargetLanguage(tag)).toStrictEqual({ targetLanguage, targetRegion });
  });

  it.each([
    ["zh-TW", "zh-TW"],
    ["zh-Hans-CN", "zh"],
    ["sr-Latn", "sr-Latn"],
    ["pa-Arab", "pa-PK"],
    ["uz-Cyrl", "uz-Cyrl"],
    ["cmn", "zh"],
    ["ar-EG", "ar"],
    ["it-IT", "it"],
  ])("keeps %s's variety as today, as %s, without a country", (tag, targetLanguage) => {
    expect(splitTargetLanguage(tag)).toStrictEqual({ targetLanguage, targetRegion: null });
  });
});

describe(getTaughtRegion, () => {
  it("is the country whose variety lessons teach, one of the language's", () => {
    const taught = ["es", "pt", "en", "fr", "de"].map((language) => getTaughtRegion(language));

    expect(taught).toStrictEqual(["MX", "BR", "US", "FR", "DE"]);
  });

  it("has none for a language without countries", () => {
    expect(getTaughtRegion("ar")).toBeNull();
    expect(getTaughtRegion("ja")).toBeNull();
  });
});

describe(isLanguageRegion, () => {
  it("takes only the language's own countries", () => {
    expect(isLanguageRegion({ language: "es", region: "AR" })).toBe(true);
    expect(isLanguageRegion({ language: "pt", region: "AR" })).toBe(false);
    expect(isLanguageRegion({ language: "ar", region: "EG" })).toBe(false);
    expect(isLanguageRegion({ language: "es-AR", region: "AR" })).toBe(false);
  });
});

describe(getRegionChoices, () => {
  it("names every country in the learner's language, sorted, marking the taught one", () => {
    const choices = getRegionChoices({ language: "pt", userLanguage: "es" });

    expect(choices.map((choice) => choice.code).toSorted()).toStrictEqual(
      [...getLanguageRegions("pt")].toSorted(),
    );

    expect(choices.slice(0, 2)).toStrictEqual([
      { code: "AO", name: "Angola", taught: false },
      { code: "BR", name: "Brasil", taught: true },
    ]);
  });

  it("has no choices for a language without countries", () => {
    expect(getRegionChoices({ language: "ar", userLanguage: "en" })).toStrictEqual([]);
  });
});

describe(getVarietyName, () => {
  it("names the language and the country chosen, in the viewer's language", () => {
    expect(getVarietyName({ language: "es", region: "AR", userLanguage: "en" })).toBe(
      "Spanish (Argentina)",
    );

    expect(getVarietyName({ language: "es", region: "MX", userLanguage: "en" })).toBe(
      "Spanish (Mexico)",
    );

    expect(getVarietyName({ language: "en", region: "GB", userLanguage: "pt" })).toBe(
      "Inglês (Reino Unido)",
    );
  });

  it("names only the language without a country, never the taught one", () => {
    expect(getVarietyName({ language: "es", region: null, userLanguage: "en" })).toBe("Spanish");
    expect(getVarietyName({ language: "pt", userLanguage: "es" })).toBe("Portugués");
    expect(getVarietyName({ language: "zh-TW", userLanguage: "en" })).toBe("Chinese (Taiwan)");
  });
});

describe(getVarietyFlagCode, () => {
  it("shows the chosen country's flag, else the language's", () => {
    expect(getVarietyFlagCode({ language: "es", region: "AR" })).toBe("ar");
    expect(getVarietyFlagCode({ language: "es", region: null })).toBe("mx");
    expect(getVarietyFlagCode({ language: "ar" })).toBe("arab");
  });

  it("ignores a country the language doesn't list", () => {
    expect(getVarietyFlagCode({ language: "es", region: "JP" })).toBe("mx");
  });
});
