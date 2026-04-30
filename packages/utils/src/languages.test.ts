import { describe, expect, it } from "vitest";
import { getLanguageName, isTTSSupportedLanguage, needsRomanization } from "./languages";

describe(isTTSSupportedLanguage, () => {
  it("returns true for a valid language code", () => {
    expect(isTTSSupportedLanguage("es")).toBe(true);
  });

  it("returns true for another valid language code", () => {
    expect(isTTSSupportedLanguage("ja")).toBe(true);
  });

  it("returns false for an invalid language code", () => {
    expect(isTTSSupportedLanguage("xx")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isTTSSupportedLanguage(null)).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isTTSSupportedLanguage(42)).toBe(false);
  });
});

describe(needsRomanization, () => {
  it.each([
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

  it.each(["en", "es", "fr", "de", "pt", "it"])(
    "returns false for Roman script language: %s",
    (code) => {
      expect(needsRomanization(code)).toBe(false);
    },
  );

  it("returns false for unknown language codes", () => {
    expect(needsRomanization("xyz")).toBe(false);
  });
});

describe(getLanguageName, () => {
  it("returns localized name when userLanguage is provided", () => {
    expect(getLanguageName({ targetLanguage: "es", userLanguage: "en" })).toBe("Spanish");
  });

  it("returns name in a different locale", () => {
    expect(getLanguageName({ targetLanguage: "es", userLanguage: "pt" })).toBe("Espanhol");
  });

  it("returns native name when userLanguage is omitted", () => {
    expect(getLanguageName({ targetLanguage: "es" })).toBe("Español");
  });

  it("returns native name for Japanese", () => {
    expect(getLanguageName({ targetLanguage: "ja" })).toBe("日本語");
  });

  it("capitalizes the first letter", () => {
    const name = getLanguageName({ targetLanguage: "fr", userLanguage: "en" });
    expect(name).toBe("French");
    expect(name[0]).toBe(name[0]?.toUpperCase());
  });
});
