import { describe, expect, test } from "vitest";
import {
  deduplicateNormalizedTexts,
  deduplicateSlugs,
  emptyToNull,
  ensureLocaleSuffix,
  extractUniqueSentenceWords,
  hasWholePhrase,
  normalizePunctuation,
  normalizeString,
  removeAccents,
  removeLocaleSuffix,
  replaceNamePlaceholder,
  replaceWholePhrase,
  segmentWords,
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
  test("basic slug behavior", () => {
    expect(toSlug("Hello World")).toBe("hello-world");
    expect(toSlug("  Hello   World  ")).toBe("hello-world");
    expect(toSlug("hello-world")).toBe("hello-world");
    expect(toSlug("---hello---world---")).toBe("hello-world");
    expect(toSlug("hello\tworld\nfoo")).toBe("hello-world-foo");
    expect(toSlug("UPPERCASE")).toBe("uppercase");
    expect(toSlug("a")).toBe("a");
  });

  test("strips Latin accents", () => {
    expect(toSlug("Café")).toBe("cafe");
    expect(toSlug("São Paulo")).toBe("sao-paulo");
    expect(toSlug("El Niño")).toBe("el-nino");
    expect(toSlug("Über")).toBe("uber");
    expect(toSlug("Façade")).toBe("facade");
    expect(toSlug("Français Español Português")).toBe("francais-espanol-portugues");
  });

  test("preserves special Latin characters as Unicode", () => {
    expect(toSlug("Straße")).toBe("straße");
    expect(toSlug("Ærø")).toBe("ærø");
  });

  test("preserves CJK characters", () => {
    expect(toSlug("わけはずもの")).toBe("わけはずもの");
    expect(toSlug("日本語が話せます")).toBe("日本語が話せます");
    expect(toSlug("你好世界")).toBe("你好世界");
    expect(toSlug("당근마켓")).toBe("당근마켓");
  });

  test("handles mixed Latin and CJK (the bug fix)", () => {
    expect(toSlug("Estruturas com わけ・はず・もの")).toBe("estruturas-com-わけはずもの");
    expect(toSlug("Estruturas com よう・みたい・らしい")).toBe("estruturas-com-ようみたいらしい");
    expect(toSlug("Condicional com と")).toBe("condicional-com-と");
    expect(toSlug("Condicional com たら")).toBe("condicional-com-たら");

    const slugs = [
      toSlug("Estruturas com わけ・はず・もの"),
      toSlug("Estruturas com よう・みたい・らしい"),
      toSlug("Condicional com と"),
      toSlug("Condicional com たら"),
    ];

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test("preserves other Unicode scripts", () => {
    expect(toSlug("สวัสดี")).toBe("สวัสดี");
    expect(toSlug("हिन्दी")).toBe("हिन्दी");
    expect(toSlug("مرحبا")).toBe("مرحبا");
    expect(toSlug("αλφα βήτα")).toBe("αλφα-βητα");
    expect(toSlug("москва")).toBe("москва");
    expect(toSlug("שלום")).toBe("שלום");
    expect(toSlug("თბილისი")).toBe("თბილისი");
  });

  test("removes punctuation and symbols", () => {
    expect(toSlug("dev.ops")).toBe("devops");
    expect(toSlug("john.doe.smith")).toBe("johndoesmith");
    expect(toSlug("Hello (World) [Test]")).toBe("hello-world-test");
    expect(toSlug("Rock & Roll")).toBe("rock-roll");
    expect(toSlug("Hello! @World #1")).toBe("hello-world-1");
    expect(toSlug("5★ stars")).toBe("5-stars");
    expect(toSlug("Hello 😀 World")).toBe("hello-world");
    expect(toSlug("わけ・はず")).toBe("わけはず");
  });

  test("edge cases", () => {
    expect(toSlug("")).toBe("");
    expect(toSlug("   ")).toBe("");
    expect(toSlug("...!!!")).toBe("");
    expect(toSlug("123")).toBe("123");
    expect(toSlug("Test 123 Foo")).toBe("test-123-foo");
  });

  test("truncates to SLUG_MAX_LENGTH", () => {
    const long = "a".repeat(100);
    expect(toSlug(long)).toBe("a".repeat(50));
    expect(
      toSlug("Introduction to Conditional Probability and Bayesian Inference Methods"),
    ).toHaveLength(50);
  });

  test("strips trailing hyphen left by truncation", () => {
    expect(toSlug("Existing Completed Course 7cf0f58c-c844-4e77-b93d-862b088c72e0")).toBe(
      "existing-completed-course-7cf0f58c-c844-4e77-b93d",
    );
  });
});

describe(deduplicateSlugs, () => {
  test("leaves unique slugs unchanged", () => {
    const items = [{ slug: "a" }, { slug: "b" }];
    expect(deduplicateSlugs(items)).toEqual([{ slug: "a" }, { slug: "b" }]);
  });

  test("appends counter suffix to duplicate slugs", () => {
    const items = [{ slug: "x" }, { slug: "x" }, { slug: "x" }];
    expect(deduplicateSlugs(items)).toEqual([{ slug: "x" }, { slug: "x-1" }, { slug: "x-2" }]);
  });

  test("uses 1-based counter regardless of array position", () => {
    const items = [{ slug: "a" }, { slug: "x" }, { slug: "x" }];
    expect(deduplicateSlugs(items)).toEqual([{ slug: "a" }, { slug: "x" }, { slug: "x-1" }]);
  });

  test("avoids collision with pre-existing slugs", () => {
    const items = [{ slug: "x" }, { slug: "x" }, { slug: "x-1" }];
    expect(deduplicateSlugs(items)).toEqual([{ slug: "x" }, { slug: "x-2" }, { slug: "x-1" }]);
  });

  test("preserves extra properties", () => {
    const items = [
      { slug: "a", title: "A" },
      { slug: "a", title: "B" },
    ];
    const result = deduplicateSlugs(items);
    expect(result[0]).toEqual({ slug: "a", title: "A" });
    expect(result[1]).toEqual({ slug: "a-1", title: "B" });
  });

  test("handles empty array", () => {
    expect(deduplicateSlugs([])).toEqual([]);
  });

  test("handles single item", () => {
    expect(deduplicateSlugs([{ slug: "a" }])).toEqual([{ slug: "a" }]);
  });
});

describe(deduplicateNormalizedTexts, () => {
  test("deduplicates text after punctuation and string normalization", () => {
    expect(deduplicateNormalizedTexts([" Bonjour ! ", "Bonjour!", "Oi", "oi "])).toEqual([
      "Bonjour!",
      "oi",
    ]);
  });

  test("keeps the first key order while preserving the latest display text", () => {
    expect(deduplicateNormalizedTexts(["Olá", "Oi", "Ola"])).toEqual(["Ola", "Oi"]);
  });
});

describe(normalizePunctuation, () => {
  test("removes space before exclamation mark", () => {
    expect(normalizePunctuation("Hello !")).toBe("Hello!");
  });

  test("removes space before question mark", () => {
    expect(normalizePunctuation("Comment ?")).toBe("Comment?");
  });

  test("removes space before period", () => {
    expect(normalizePunctuation("Fin .")).toBe("Fin.");
  });

  test("removes multiple spaces before punctuation", () => {
    expect(normalizePunctuation("Hello  !")).toBe("Hello!");
  });

  test("leaves already-correct text unchanged", () => {
    expect(normalizePunctuation("Hello!")).toBe("Hello!");
  });

  test("handles CJK punctuation", () => {
    expect(normalizePunctuation("これは何 ？")).toBe("これは何？");
  });

  test("handles Arabic question mark", () => {
    expect(normalizePunctuation("مرحبا ؟")).toBe("مرحبا؟");
  });

  test("handles empty string", () => {
    expect(normalizePunctuation("")).toBe("");
  });

  test("handles multiple punctuation in one sentence", () => {
    expect(normalizePunctuation("Bonjour , comment allez-vous ?")).toBe(
      "Bonjour, comment allez-vous?",
    );
  });
});

describe(hasWholePhrase, () => {
  test("matches a full phrase without matching inside another word", () => {
    expect(hasWholePhrase("the cat sleeps", "he")).toBeFalsy();
    expect(hasWholePhrase("he sleeps", "he")).toBeTruthy();
  });

  test("matches phrases even when the text uses extra spaces", () => {
    expect(hasWholePhrase("Guten   Tag, Anna!", "Guten Tag")).toBeTruthy();
  });

  test("matches Unicode words using Unicode-aware boundaries", () => {
    expect(hasWholePhrase("Olá, Lara!", "Olá")).toBeTruthy();
    expect(hasWholePhrase("猫、犬", "猫")).toBeTruthy();
    expect(hasWholePhrase("猫です", "猫")).toBeFalsy();
  });

  test("returns false for an empty phrase", () => {
    expect(hasWholePhrase("hello world", "")).toBeFalsy();
    expect(hasWholePhrase("", "")).toBeFalsy();
  });
});

describe(replaceWholePhrase, () => {
  test("replaces only the matched whole phrase", () => {
    expect(replaceWholePhrase("he said hello", "he", "she")).toBe("she said hello");
    expect(replaceWholePhrase("the hero arrived", "he", "she")).toBeNull();
  });

  test("keeps normalized punctuation when it replaces a phrase", () => {
    expect(replaceWholePhrase("Bonjour !", "Bonjour", "Salut")).toBe("Salut!");
  });

  test("returns null for an empty search phrase", () => {
    expect(replaceWholePhrase("hello world", "", "goodbye")).toBeNull();
    expect(replaceWholePhrase("", "", "goodbye")).toBeNull();
  });
});

describe(segmentWords, () => {
  test("splits space-delimited text by spaces", () => {
    expect(segmentWords("Hola mundo")).toEqual(["Hola", "mundo"]);
    expect(segmentWords("Yo veo un gato.")).toEqual(["Yo", "veo", "un", "gato."]);
  });

  test("segments Japanese text into individual words", () => {
    const result = segmentWords("あのやまはきれいです");
    expect(result.length).toBeGreaterThan(1);
    expect(result).toContain("あの");
    expect(result).toContain("きれい");
    expect(result).toContain("です");
  });

  test("segments Chinese text into individual words", () => {
    const result = segmentWords("猫吃鱼");
    expect(result.length).toBeGreaterThan(1);
  });

  test("handles single word", () => {
    expect(segmentWords("hello")).toEqual(["hello"]);
    expect(segmentWords("猫")).toEqual(["猫"]);
  });

  test("handles empty string", () => {
    expect(segmentWords("")).toEqual([]);
  });

  test("filters empty tokens from consecutive spaces", () => {
    expect(segmentWords("hello  world")).toEqual(["hello", "world"]);
    expect(segmentWords("a  b  c")).toEqual(["a", "b", "c"]);
  });

  test("attaches French-style punctuation to preceding word", () => {
    expect(segmentWords("Comment allez-vous ?")).toEqual(["Comment", "allez-vous?"]);
    expect(segmentWords("Bonjour !")).toEqual(["Bonjour!"]);
  });

  test("handles multiple French-style punctuation in one sentence", () => {
    expect(segmentWords("Oui , je suis là !")).toEqual(["Oui,", "je", "suis", "là!"]);
  });

  test("keeps connector-linked tokens intact without spaces", () => {
    expect(segmentWords("gato-prueba")).toEqual(["gato-prueba"]);
    expect(segmentWords("l'heure")).toEqual(["l'heure"]);
    expect(segmentWords("allez-vous?")).toEqual(["allez-vous?"]);
  });

  test("keeps surrounding punctuation on non-space tokens", () => {
    expect(segmentWords("¿Hola?")).toEqual(["¿Hola?"]);
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

  test("handles non-space-delimited text via Intl.Segmenter", () => {
    const result = extractUniqueSentenceWords(["猫は食べる"]);
    expect(result.length).toBeGreaterThan(1);
    expect(result).toContain("猫");
    expect(result).toContain("食べる");
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
