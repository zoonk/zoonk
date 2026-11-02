import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getLanguageName,
  getLanguageNameInSentence,
  getMaiVoiceLocale,
  isFlashLiteTTSLanguage,
  isTTSSupportedLanguage,
  toCanonicalLanguage,
  usesNonLatinScript,
} from "./languages";
import { SUPPORTED_LOCALES } from "./locale";

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

  it("voices Cantonese apart from Mandarin", () => {
    expect(isTTSSupportedLanguage("yue")).toBe(true);
  });
});

describe(isFlashLiteTTSLanguage, () => {
  it("leaves out the languages only Gemini Flash speaks", () => {
    expect(isFlashLiteTTSLanguage("es")).toBe(true);
    expect(isFlashLiteTTSLanguage("sv")).toBe(false);
    expect(isFlashLiteTTSLanguage("xx")).toBe(false);
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

  it("knows the script of a language without a list", () => {
    expect(usesNonLatinScript("yue")).toBe(true);
    expect(usesNonLatinScript("kk")).toBe(true);
  });

  it("follows a script the tag names", () => {
    expect(usesNonLatinScript("sr")).toBe(true);
    expect(usesNonLatinScript("sr-Latn")).toBe(false);
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

describe(getLanguageNameInSentence, () => {
  const targetLanguages = ["en", "es", "pt", "de", "ja", "ar", "zh-TW", "tpi"];

  // Node gives CLDR's names, cased for the middle of a sentence ("inglês", "Englisch").
  const cases = SUPPORTED_LOCALES.flatMap((userLanguage) =>
    targetLanguages.map((targetLanguage) => ({
      expected: new Intl.DisplayNames([userLanguage], { type: "language" }).of(targetLanguage),
      targetLanguage,
      userLanguage,
    })),
  );

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the casing a sentence needs in every app language", () => {
    for (const { expected, targetLanguage, userLanguage } of cases) {
      expect(getLanguageNameInSentence({ targetLanguage, userLanguage })).toBe(expected);
    }
  });

  it("writes the same name when the browser capitalizes it, as Safari does", () => {
    // Node can't run Safari's engine, which capitalizes names it gives on their own ("Inglês").
    class SafariDisplayNames extends Intl.DisplayNames {
      override of(code: string): string | undefined {
        const name = super.of(code);
        return name && name.charAt(0).toUpperCase() + name.slice(1);
      }
    }

    vi.spyOn(Intl, "DisplayNames").mockImplementation(SafariDisplayNames);

    for (const { expected, targetLanguage, userLanguage } of cases) {
      expect(getLanguageNameInSentence({ targetLanguage, userLanguage })).toBe(expected);
    }
  });
});
