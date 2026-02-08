import { describe, expect, test } from "vitest";
import { TTS_SUPPORTED_LANGUAGE_CODES, getLanguageName, isTTSSupportedLanguage } from "./languages";

describe(isTTSSupportedLanguage, () => {
  test("supported language codes has exactly 57 entries", () => {
    expect(TTS_SUPPORTED_LANGUAGE_CODES).toHaveLength(57);
  });

  test("returns true for a valid language code", () => {
    expect(isTTSSupportedLanguage("es")).toBeTruthy();
  });

  test("returns true for another valid language code", () => {
    expect(isTTSSupportedLanguage("ja")).toBeTruthy();
  });

  test("returns false for an invalid language code", () => {
    expect(isTTSSupportedLanguage("xx")).toBeFalsy();
  });

  test("returns false for null", () => {
    expect(isTTSSupportedLanguage(null)).toBeFalsy();
  });

  test("returns false for a number", () => {
    expect(isTTSSupportedLanguage(42)).toBeFalsy();
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
