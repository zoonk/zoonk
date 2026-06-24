import { describe, expect, it } from "vitest";
import { getLanguageOptions } from "./language-options";

describe(getLanguageOptions, () => {
  it("pins popular languages for English learners and removes English", () => {
    const languages = getLanguageOptions({ locale: "en" });

    expect(languages.slice(0, 8).map((language) => language.code)).toStrictEqual([
      "es",
      "fr",
      "ja",
      "de",
      "ko",
      "it",
      "zh",
      "pt",
    ]);

    expect(languages.some((language) => language.code === "en")).toBe(false);
  });

  it("derives flags for supported languages without a per-language map", () => {
    const languages = [
      ...getLanguageOptions({ locale: "en" }),
      ...getLanguageOptions({ locale: "es" }),
    ];

    expect(languages.every((language) => language.flag.length > 0)).toBe(true);
    expect(languages.find((language) => language.code === "en")?.flag).toBe("🇺🇸");
    expect(languages.find((language) => language.code === "pt")?.flag).toBe("🇧🇷");
  });

  it("pins popular languages for Spanish learners and removes Spanish", () => {
    const languages = getLanguageOptions({ locale: "es" });

    expect(languages.slice(0, 8).map((language) => language.code)).toStrictEqual([
      "en",
      "pt",
      "fr",
      "it",
      "ja",
      "de",
      "ko",
      "zh",
    ]);

    expect(languages.some((language) => language.code === "es")).toBe(false);
  });

  it("pins popular languages for Portuguese learners and removes Portuguese", () => {
    const languages = getLanguageOptions({ locale: "pt" });

    expect(languages.slice(0, 8).map((language) => language.code)).toStrictEqual([
      "en",
      "es",
      "fr",
      "it",
      "ja",
      "de",
      "ko",
      "zh",
    ]);

    expect(languages.some((language) => language.code === "pt")).toBe(false);
  });

  it("pins popular languages for French learners and removes French", () => {
    const languages = getLanguageOptions({ locale: "fr" });

    expect(languages.slice(0, 8).map((language) => language.code)).toStrictEqual([
      "en",
      "es",
      "de",
      "it",
      "pt",
      "ja",
      "ko",
      "zh",
    ]);

    expect(languages.some((language) => language.code === "fr")).toBe(false);
  });

  it("pins popular languages for German learners and removes German", () => {
    const languages = getLanguageOptions({ locale: "de" });

    expect(languages.slice(0, 8).map((language) => language.code)).toStrictEqual([
      "en",
      "es",
      "fr",
      "it",
      "pt",
      "ja",
      "ko",
      "zh",
    ]);

    expect(languages.some((language) => language.code === "de")).toBe(false);
  });
});
