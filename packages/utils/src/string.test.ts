import { describe, expect, test } from "vitest";
import {
  emptyToNull,
  ensureLocaleSuffix,
  extractUniqueSentenceWords,
  normalizeString,
  removeAccents,
  removeLocaleSuffix,
  replaceNamePlaceholder,
  stripPunctuation,
  toSlug,
} from "./string";

describe(removeAccents, () => {
  test("removes diacritics from string", () => {
    expect(removeAccents("café")).toBe("cafe");
    expect(removeAccents("naïve")).toBe("naive");
    expect(removeAccents("São Paulo")).toBe("Sao Paulo");
    expect(removeAccents("Zürich")).toBe("Zurich");
    expect(removeAccents("José")).toBe("Jose");
  });

  test("preserves strings without accents", () => {
    expect(removeAccents("hello")).toBe("hello");
    expect(removeAccents("world")).toBe("world");
    expect(removeAccents("123")).toBe("123");
  });

  test("handles empty string", () => {
    expect(removeAccents("")).toBe("");
  });

  test("handles mixed characters", () => {
    expect(removeAccents("Olá, tudo bem?")).toBe("Ola, tudo bem?");
    expect(removeAccents("Français, Español, Português")).toBe("Francais, Espanol, Portugues");
  });
});

describe(normalizeString, () => {
  test("removes accents and converts to lowercase", () => {
    expect(normalizeString("CAFÉ")).toBe("cafe");
    expect(normalizeString("São Paulo")).toBe("sao paulo");
    expect(normalizeString("José")).toBe("jose");
  });

  test("trims whitespace", () => {
    expect(normalizeString("  hello  ")).toBe("hello");
    expect(normalizeString("  world  ")).toBe("world");
  });

  test("replaces multiple spaces with single space", () => {
    expect(normalizeString("hello    world")).toBe("hello world");
    expect(normalizeString("foo  bar   baz")).toBe("foo bar baz");
  });

  test("handles combined transformations", () => {
    expect(normalizeString("  CAFÉ  COM  LEITE  ")).toBe("cafe com leite");
    expect(normalizeString("  São   Paulo   ")).toBe("sao paulo");
  });

  test("removes special characters", () => {
    expect(normalizeString("Café! @Home #1")).toBe("cafe! @home #1");
    expect(normalizeString("  Hello, World!  ")).toBe("hello, world!");
  });

  test("handles empty string", () => {
    expect(normalizeString("")).toBe("");
  });

  test("handles string with only spaces", () => {
    expect(normalizeString("   ")).toBe("");
  });
});

describe(emptyToNull, () => {
  test("converts empty string to null", () => {
    expect(emptyToNull("")).toBeNull();
  });

  test("converts whitespace-only string to null", () => {
    expect(emptyToNull("  ")).toBeNull();
  });

  test("converts null to null", () => {
    expect(emptyToNull(null)).toBeNull();
  });

  test("converts undefined to null", () => {
    expect(emptyToNull()).toBeNull();
  });

  test("returns non-empty string as-is", () => {
    expect(emptyToNull("romaji")).toBe("romaji");
  });
});

describe(ensureLocaleSuffix, () => {
  test("returns slug unchanged for English", () => {
    expect(ensureLocaleSuffix("machine-learning", "en")).toBe("machine-learning");
  });

  test("appends language suffix for non-English", () => {
    expect(ensureLocaleSuffix("machine-learning", "pt")).toBe("machine-learning-pt");
  });

  test("is idempotent when suffix already present", () => {
    expect(ensureLocaleSuffix("machine-learning-pt", "pt")).toBe("machine-learning-pt");
  });

  test("appends suffix for different languages", () => {
    expect(ensureLocaleSuffix("machine-learning", "es")).toBe("machine-learning-es");
    expect(ensureLocaleSuffix("machine-learning", "fr")).toBe("machine-learning-fr");
    expect(ensureLocaleSuffix("machine-learning", "ja")).toBe("machine-learning-ja");
  });
});

describe(removeLocaleSuffix, () => {
  test("returns slug unchanged for English", () => {
    expect(removeLocaleSuffix("machine-learning", "en")).toBe("machine-learning");
  });

  test("strips suffix for non-English languages", () => {
    expect(removeLocaleSuffix("machine-learning-pt", "pt")).toBe("machine-learning");
    expect(removeLocaleSuffix("machine-learning-es", "es")).toBe("machine-learning");
    expect(removeLocaleSuffix("machine-learning-fr", "fr")).toBe("machine-learning");
    expect(removeLocaleSuffix("machine-learning-ja", "ja")).toBe("machine-learning");
  });

  test("returns slug unchanged if suffix not present", () => {
    expect(removeLocaleSuffix("machine-learning", "pt")).toBe("machine-learning");
  });

  test("handles empty string", () => {
    expect(removeLocaleSuffix("", "pt")).toBe("");
  });

  test("does not strip partial suffix match", () => {
    expect(removeLocaleSuffix("report", "pt")).toBe("report");
  });
});

describe(toSlug, () => {
  test("strips dots from input", () => {
    expect(toSlug("dev.ops")).toBe("devops");
    expect(toSlug("john.doe.smith")).toBe("johndoesmith");
  });
});

describe(stripPunctuation, () => {
  test("removes punctuation from text", () => {
    expect(stripPunctuation("hello!")).toBe("hello");
    expect(stripPunctuation("world?")).toBe("world");
    expect(stripPunctuation("a,b.c")).toBe("abc");
  });

  test("preserves letters, numbers, and spaces", () => {
    expect(stripPunctuation("hello world 123")).toBe("hello world 123");
  });

  test("preserves unicode letters", () => {
    expect(stripPunctuation("café")).toBe("café");
    expect(stripPunctuation("猫")).toBe("猫");
    expect(stripPunctuation("고양이")).toBe("고양이");
  });

  test("handles empty string", () => {
    expect(stripPunctuation("")).toBe("");
  });
});

describe(extractUniqueSentenceWords, () => {
  test("extracts unique lowercase words from sentences", () => {
    const result = extractUniqueSentenceWords(["Hola mundo", "Buenos dias"]);
    expect(result).toEqual(["hola", "mundo", "buenos", "dias"]);
  });

  test("deduplicates words across sentences", () => {
    const result = extractUniqueSentenceWords(["gato bonito", "gato grande"]);
    expect(result).toContain("gato");
    expect(result.filter((word) => word === "gato")).toHaveLength(1);
  });

  test("strips punctuation from words", () => {
    const result = extractUniqueSentenceWords(["Hola, como estas?"]);
    expect(result).toContain("hola");
    expect(result).toContain("como");
    expect(result).toContain("estas");
    expect(result).not.toContain("estas?");
  });

  test("filters out empty tokens", () => {
    const result = extractUniqueSentenceWords(["hello  world"]);
    expect(result).not.toContain("");
  });

  test("returns empty array for empty input", () => {
    expect(extractUniqueSentenceWords([])).toEqual([]);
  });

  test("handles unicode words", () => {
    const result = extractUniqueSentenceWords(["猫は食べる"]);
    expect(result).toContain("猫は食べる");
  });
});

describe(replaceNamePlaceholder, () => {
  test("replaces {{NAME}} with provided name", () => {
    expect(replaceNamePlaceholder("Hello, {{NAME}}!", "Alice")).toBe("Hello, Alice!");
  });

  test("handles multiple occurrences", () => {
    expect(replaceNamePlaceholder("{{NAME}}, meet {{NAME}}", "Bob")).toBe("Bob, meet Bob");
  });

  test("strips '{{NAME}}, ' pattern when name is null", () => {
    expect(replaceNamePlaceholder("{{NAME}}, I think we have a problem.", null)).toBe(
      "I think we have a problem.",
    );
  });

  test("strips ', {{NAME}}' pattern when name is null", () => {
    expect(replaceNamePlaceholder("Hello there, {{NAME}}", null)).toBe("Hello there");
  });

  test("strips standalone {{NAME}} when name is null", () => {
    expect(replaceNamePlaceholder("{{NAME}} welcome back", null)).toBe("welcome back");
  });

  test("returns original text when no placeholder present", () => {
    expect(replaceNamePlaceholder("No placeholder here", "Alice")).toBe("No placeholder here");
    expect(replaceNamePlaceholder("No placeholder here", null)).toBe("No placeholder here");
  });
});
