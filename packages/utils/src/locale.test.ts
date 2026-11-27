import { describe, expect, it } from "vitest";
import {
  fillSlot,
  getContentLocale,
  getFormattingLocale,
  getSentenceSpace,
  getSupportedLocaleFromLanguage,
  isValidLocale,
  toSentence,
} from "./locale";

describe(getContentLocale, () => {
  it.each([
    ["en", "en"],
    ["es-419", "es"],
    ["pt-BR", "pt"],
    ["PT-pt", "pt"],
    ["fr-Latn-CA", "fr"],
    ["de-DE", "de"],
    ["it-IT", "it"],
    ["ja-JP", "ja"],
    ["ko-KR", "ko"],
    ["tr-TR", "tr"],
    ["pl-PL", "pl"],
  ])("matches the supported route locale for %s", (language, locale) => {
    expect(getContentLocale(language)).toBe(locale);
  });

  it.each(["ar", "zh-Hans", "", "en_US", "pt-invalid_tag", "und", "und-Latn"])(
    "does not invent an English content locale for %s",
    (language) => {
      expect(getContentLocale(language)).toBeNull();
    },
  );
});

describe(isValidLocale, () => {
  it("accepts every app locale", () => {
    expect(
      ["en", "es", "pt", "fr", "de", "it", "ja", "ko", "tr", "pl"].every((locale) =>
        isValidLocale(locale),
      ),
    ).toBe(true);
  });

  it("rejects unsupported locale codes", () => {
    expect(isValidLocale("ru")).toBe(false);
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
    expect(getSupportedLocaleFromLanguage("ru")).toBe("en");
  });
});

describe(getFormattingLocale, () => {
  it("formats Spanish like Mexico, the variety the app and its courses use", () => {
    expect(getFormattingLocale("es")).toBe("es-MX");
  });

  it("keeps every other language and an explicit region as they are", () => {
    expect(getFormattingLocale("pt")).toBe("pt");
    expect(getFormattingLocale("es-AR")).toBe("es-AR");
  });
});

describe(getSentenceSpace, () => {
  it.each(["ja", "ja-JP", "zh", "zh-TW", "yue"])("joins %s sentences with no space", (locale) => {
    expect(getSentenceSpace(locale)).toBe("");
  });

  it.each(["en", "ko", "tr", "es-MX", "pt", "fr"])("joins %s sentences with a space", (locale) => {
    expect(getSentenceSpace(locale)).toBe(" ");
  });
});

describe(toSentence, () => {
  it.each([
    { locale: "en", sentence: "Price: up.", text: "Price: up" },
    { locale: "pt", sentence: "Preço: sobe.", text: "Preço: sobe" },
    { locale: "ja", sentence: "価格：上がる。", text: "価格：上がる" },
    { locale: "en", sentence: "Cost moved up.", text: "Cost moved up." },
    { locale: "ja", sentence: "動いた。", text: "動いた。" },
  ])("ends $text as a sentence in $locale", ({ locale, sentence, text }) => {
    expect(toSentence(text, locale)).toBe(sentence);
  });
});

describe(fillSlot, () => {
  it.each([
    ["Matched # with lunch.", "il pranzo", "Matched il pranzo with lunch."],
    [
      "Matched lunch with #. Pairs matched: 1 of 5.",
      "qui di fronte.",
      "Matched lunch with qui di fronte. Pairs matched: 1 of 5.",
    ],
    ["# and lunch don't go together.", "Va bene!", "Va bene! and lunch don't go together."],
    ["Lunch and # don't go together.", "Va bene?", "Lunch and Va bene? don't go together."],
    ["Unmatched lunch and #.", "Va bene?", "Unmatched lunch and Va bene?"],
    ["「#」と「昼食」を組み合わせました。", "明日。", "「明日。」と「昼食」を組み合わせました。"],
    ["#と昼食を組み合わせました。", "明日。", "明日。と昼食を組み合わせました。"],
    ["Matched lunch with #。", "明日。", "Matched lunch with 明日。"],
    ["No slot here.", "lunch.", "No slot here."],
  ])("%j with %j reads %j", (line, text, expected) => {
    expect(fillSlot(line, "#", text)).toBe(expected);
  });
});
