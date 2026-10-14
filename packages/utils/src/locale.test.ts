import { describe, expect, it } from "vitest";
import { getContentLocale, getSupportedLocaleFromLanguage, isValidLocale } from "./locale";

describe(getContentLocale, () => {
  it.each([
    ["en", "en"],
    ["es-419", "es"],
    ["pt-BR", "pt"],
    ["PT-pt", "pt"],
    ["fr-Latn-CA", "fr"],
    ["de-DE", "de"],
  ])("matches the supported route locale for %s", (language, locale) => {
    expect(getContentLocale(language)).toBe(locale);
  });

  it.each(["it", "ja-JP", "", "en_US", "pt-invalid_tag", "und", "und-Latn"])(
    "does not invent an English content locale for %s",
    (language) => {
      expect(getContentLocale(language)).toBeNull();
    },
  );
});

describe(isValidLocale, () => {
  it("accepts every app locale", () => {
    expect(["en", "es", "pt", "fr", "de"].every((locale) => isValidLocale(locale))).toBe(true);
  });

  it("rejects unsupported locale codes", () => {
    expect(isValidLocale("it")).toBe(false);
  });
});

describe(getSupportedLocaleFromLanguage, () => {
  it("keeps supported base languages", () => {
    expect(getSupportedLocaleFromLanguage("pt")).toBe("pt");
  });

  it("uses the base language from regional language tags", () => {
    expect(getSupportedLocaleFromLanguage("pt-BR")).toBe("pt");
  });

  it("falls back to English for unsupported languages", () => {
    expect(getSupportedLocaleFromLanguage("it")).toBe("en");
  });
});
