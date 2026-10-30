import { describe, expect, it } from "vitest";
import {
  getLanguageName,
  getMaiVoiceLocale,
  isTTSSupportedLanguage,
  toCanonicalLanguage,
  usesNonLatinScript,
} from "./languages";

describe(getMaiVoiceLocale, () => {
  it("returns the locale MAI-Voice speaks a language in", () => {
    expect(getMaiVoiceLocale("pt")).toBe("pt-BR");
  });

  it("returns null for a language MAI-Voice doesn't speak", () => {
    expect(getMaiVoiceLocale("ja")).toBeNull();
  });
});

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

  it("reads the language from a code with a region", () => {
    expect(isTTSSupportedLanguage("zh-TW")).toBe(true);
  });
});

describe(toCanonicalLanguage, () => {
  it("gives every code for simplified Mandarin the same tag", () => {
    expect(
      ["cmn", "zh-CN", "zh-Hans", "zh-Hans-CN"].map((code) => toCanonicalLanguage(code)),
    ).toStrictEqual(["zh", "zh", "zh", "zh"]);
  });

  it("keeps traditional characters apart as Taiwan's Chinese", () => {
    expect(toCanonicalLanguage("zh-Hant")).toBe("zh-TW");
  });

  it("drops a region only when it's the language's usual one", () => {
    expect([toCanonicalLanguage("pt-BR"), toCanonicalLanguage("pt-PT")]).toStrictEqual([
      "pt",
      "pt-PT",
    ]);
  });
});

describe(usesNonLatinScript, () => {
  it("returns false for unknown language codes", () => {
    expect(usesNonLatinScript("xyz")).toBe(false);
  });

  it("reads the language from a code with a region", () => {
    expect(usesNonLatinScript("zh-TW")).toBe(true);
    expect(usesNonLatinScript("pt-BR")).toBe(false);
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
});
