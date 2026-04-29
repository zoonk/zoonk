import { describe, expect, test } from "vitest";
import { getLanguageName, isTTSSupportedLanguage, needsRomanization } from "./languages";

describe(isTTSSupportedLanguage, () => {
  test("returns true for a valid language code", () => {
    expect(isTTSSupportedLanguage("es")).toBe(true);
  });

  test("returns true for another valid language code", () => {
    expect(isTTSSupportedLanguage("ja")).toBe(true);
  });

  test("returns false for an invalid language code", () => {
    expect(isTTSSupportedLanguage("xx")).toBe(false);
  });

  test("returns false for null", () => {
    expect(isTTSSupportedLanguage(null)).toBe(false);
  });

  test("returns false for a number", () => {
    expect(isTTSSupportedLanguage(42)).toBe(false);
  });
});

describe(needsRomanization, () => {
  test.each([
    "ja",
    "zh",
    "ko",
    "ar",
    "ru",
    "el",
    "he",
    "hi",
    "th",
    "fa",
    "bn",
    "ka",
    "km",
    "my",
    "am",
    "pa",
    "te",
    "ml",
  ])("returns true for non-Roman script language: %s", (code) => {
    expect(needsRomanization(code)).toBe(true);
  });

  test.each(["en", "es", "fr", "de", "pt", "it"])(
    "returns false for Roman script language: %s",
    (code) => {
      expect(needsRomanization(code)).toBe(false);
    },
  );

  test("returns false for unknown language codes", () => {
    expect(needsRomanization("xyz")).toBe(false);
  });
});

describe(getLanguageName, () => {
  test("returns localized name when userLanguage is provided", () => {
    expect(getLanguageName({ targetLanguage: "es", userLanguage: "en" })).toBe("Spanish");
  });

  test("returns name in a different locale", () => {
    expect(getLanguageName({ targetLanguage: "es", userLanguage: "pt" })).toBe("Espanhol");
  });

  test("returns native name when userLanguage is omitted", () => {
    expect(getLanguageName({ targetLanguage: "es" })).toBe("Español");
  });

  test("returns native name for Japanese", () => {
    expect(getLanguageName({ targetLanguage: "ja" })).toBe("日本語");
  });

  test("capitalizes the first letter", () => {
    const name = getLanguageName({ targetLanguage: "fr", userLanguage: "en" });
    expect(name).toBe("French");
    expect(name[0]).toBe(name[0]?.toUpperCase());
  });
});
