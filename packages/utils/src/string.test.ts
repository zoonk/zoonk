import { describe, expect, it } from "vitest";
import {
  deduplicateNormalizedTexts,
  deduplicateSlugs,
  emptyToNull,
  ensureLocaleSuffix,
  extractUniqueSentenceWords,
  normalizePunctuation,
  normalizeString,
  removeAccents,
  replaceNamePlaceholder,
  segmentWords,
  stripPunctuation,
  toSlug,
} from "./string";

describe(removeAccents, () => {
  it("removes diacritics from string", () => {
    expect(removeAccents("café")).toBe("cafe");
    expect(removeAccents("naïve")).toBe("naive");
    expect(removeAccents("São Paulo")).toBe("Sao Paulo");
    expect(removeAccents("Zürich")).toBe("Zurich");
    expect(removeAccents("José")).toBe("Jose");
  });

  it("preserves strings without accents", () => {
    expect(removeAccents("hello")).toBe("hello");
    expect(removeAccents("world")).toBe("world");
    expect(removeAccents("123")).toBe("123");
  });

  it("handles empty string", () => {
    expect(removeAccents("")).toBe("");
  });

  it("handles mixed characters", () => {
    expect(removeAccents("Olá, tudo bem?")).toBe("Ola, tudo bem?");
    expect(removeAccents("Français, Español, Português")).toBe("Francais, Espanol, Portugues");
  });
});

describe(normalizeString, () => {
  it("removes accents and converts to lowercase", () => {
    expect(normalizeString("CAFÉ")).toBe("cafe");
    expect(normalizeString("São Paulo")).toBe("sao paulo");
    expect(normalizeString("José")).toBe("jose");
  });

  it("trims whitespace", () => {
    expect(normalizeString("  hello  ")).toBe("hello");
    expect(normalizeString("  world  ")).toBe("world");
  });

  it("replaces multiple spaces with single space", () => {
    expect(normalizeString("hello    world")).toBe("hello world");
    expect(normalizeString("foo  bar   baz")).toBe("foo bar baz");
  });

  it("handles combined transformations", () => {
    expect(normalizeString("  CAFÉ  COM  LEITE  ")).toBe("cafe com leite");
    expect(normalizeString("  São   Paulo   ")).toBe("sao paulo");
  });

  it("removes special characters", () => {
    expect(normalizeString("Café! @Home #1")).toBe("cafe! @home #1");
    expect(normalizeString("  Hello, World!  ")).toBe("hello, world!");
  });

  it("handles empty string", () => {
    expect(normalizeString("")).toBe("");
  });

  it("handles string with only spaces", () => {
    expect(normalizeString("   ")).toBe("");
  });
});

describe(emptyToNull, () => {
  it("converts empty string to null", () => {
    expect(emptyToNull("")).toBeNull();
  });

  it("converts whitespace-only string to null", () => {
    expect(emptyToNull("  ")).toBeNull();
  });

  it("converts null to null", () => {
    expect(emptyToNull(null)).toBeNull();
  });

  it("converts undefined to null", () => {
    expect(emptyToNull()).toBeNull();
  });

  it("returns non-empty string as-is", () => {
    expect(emptyToNull("romaji")).toBe("romaji");
  });
});

describe(ensureLocaleSuffix, () => {
  it("returns slug unchanged for English", () => {
    expect(ensureLocaleSuffix("machine-learning", "en")).toBe("machine-learning");
  });

  it("appends language suffix for non-English", () => {
    expect(ensureLocaleSuffix("machine-learning", "pt")).toBe("machine-learning-pt");
  });

  it("is idempotent when suffix already present", () => {
    expect(ensureLocaleSuffix("machine-learning-pt", "pt")).toBe("machine-learning-pt");
  });

  it("appends suffix for different languages", () => {
    expect(ensureLocaleSuffix("machine-learning", "es")).toBe("machine-learning-es");
    expect(ensureLocaleSuffix("machine-learning", "fr")).toBe("machine-learning-fr");
    expect(ensureLocaleSuffix("machine-learning", "ja")).toBe("machine-learning-ja");
  });
});

describe(toSlug, () => {
  it("basic slug behavior", () => {
    expect(toSlug("Hello World")).toBe("hello-world");
    expect(toSlug("  Hello   World  ")).toBe("hello-world");
    expect(toSlug("hello-world")).toBe("hello-world");
    expect(toSlug("---hello---world---")).toBe("hello-world");
    expect(toSlug("hello\tworld\nfoo")).toBe("hello-world-foo");
    expect(toSlug("UPPERCASE")).toBe("uppercase");
    expect(toSlug("a")).toBe("a");
  });

  it("strips Latin accents", () => {
    expect(toSlug("Café")).toBe("cafe");
    expect(toSlug("São Paulo")).toBe("sao-paulo");
    expect(toSlug("El Niño")).toBe("el-nino");
    expect(toSlug("Über")).toBe("uber");
    expect(toSlug("Façade")).toBe("facade");
    expect(toSlug("Français Español Português")).toBe("francais-espanol-portugues");
  });

  it("preserves special Latin characters as Unicode", () => {
    expect(toSlug("Straße")).toBe("straße");
    expect(toSlug("Ærø")).toBe("ærø");
  });

  it("preserves CJK characters", () => {
    expect(toSlug("わけはずもの")).toBe("わけはずもの");
    expect(toSlug("日本語が話せます")).toBe("日本語が話せます");
    expect(toSlug("你好世界")).toBe("你好世界");
    expect(toSlug("당근마켓")).toBe("당근마켓");
  });

  it("handles mixed Latin and CJK (the bug fix)", () => {
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

  it("preserves other Unicode scripts", () => {
    expect(toSlug("สวัสดี")).toBe("สวัสดี");
    expect(toSlug("हिन्दी")).toBe("हिन्दी");
    expect(toSlug("مرحبا")).toBe("مرحبا");
    expect(toSlug("αλφα βήτα")).toBe("αλφα-βητα");
    expect(toSlug("москва")).toBe("москва");
    expect(toSlug("שלום")).toBe("שלום");
    expect(toSlug("თბილისი")).toBe("თბილისი");
  });

  it("removes punctuation and symbols", () => {
    expect(toSlug("dev.ops")).toBe("devops");
    expect(toSlug("john.doe.smith")).toBe("johndoesmith");
    expect(toSlug("Hello (World) [Test]")).toBe("hello-world-test");
    expect(toSlug("Rock & Roll")).toBe("rock-roll");
    expect(toSlug("Hello! @World #1")).toBe("hello-world-1");
    expect(toSlug("5★ stars")).toBe("5-stars");
    expect(toSlug("Hello 😀 World")).toBe("hello-world");
    expect(toSlug("わけ・はず")).toBe("わけはず");
  });

  it("preserves common symbolic course names", () => {
    expect(toSlug("C++")).toBe("c-plus-plus");
    expect(toSlug("C#")).toBe("c-sharp");
    expect(toSlug("F#")).toBe("f-sharp");
    expect(toSlug(".NET")).toBe("dot-net");
    expect(toSlug("Learn .NET")).toBe("learn-dot-net");
    expect(toSlug("Hello! @World #1")).toBe("hello-world-1");
  });

  it("edge cases", () => {
    expect(toSlug("")).toBe("");
    expect(toSlug("   ")).toBe("");
    expect(toSlug("...!!!")).toBe("");
    expect(toSlug("123")).toBe("123");
    expect(toSlug("Test 123 Foo")).toBe("test-123-foo");
  });

  it("truncates to SLUG_MAX_LENGTH", () => {
    const long = "a".repeat(100);
    expect(toSlug(long)).toBe("a".repeat(50));

    expect(
      toSlug("Introduction to Conditional Probability and Bayesian Inference Methods"),
    ).toHaveLength(50);
  });

  it("strips trailing hyphen left by truncation", () => {
    expect(toSlug("Existing Completed Course 7cf0f58c-c844-4e77-b93d-862b088c72e0")).toBe(
      "existing-completed-course-7cf0f58c-c844-4e77-b93d",
    );
  });
});

describe(deduplicateSlugs, () => {
  it("leaves unique slugs unchanged", () => {
    const items = [{ slug: "a" }, { slug: "b" }];
    expect(deduplicateSlugs(items)).toStrictEqual([{ slug: "a" }, { slug: "b" }]);
  });

  it("appends counter suffix to duplicate slugs", () => {
    const items = [{ slug: "x" }, { slug: "x" }, { slug: "x" }];

    expect(deduplicateSlugs(items)).toStrictEqual([
      { slug: "x" },
      { slug: "x-1" },
      { slug: "x-2" },
    ]);
  });

  it("uses 1-based counter regardless of array position", () => {
    const items = [{ slug: "a" }, { slug: "x" }, { slug: "x" }];
    expect(deduplicateSlugs(items)).toStrictEqual([{ slug: "a" }, { slug: "x" }, { slug: "x-1" }]);
  });

  it("avoids collision with pre-existing slugs", () => {
    const items = [{ slug: "x" }, { slug: "x" }, { slug: "x-1" }];

    expect(deduplicateSlugs(items)).toStrictEqual([
      { slug: "x" },
      { slug: "x-2" },
      { slug: "x-1" },
    ]);
  });

  it("preserves extra properties", () => {
    const items = [
      { slug: "a", title: "A" },
      { slug: "a", title: "B" },
    ];

    const result = deduplicateSlugs(items);
    expect(result[0]).toStrictEqual({ slug: "a", title: "A" });
    expect(result[1]).toStrictEqual({ slug: "a-1", title: "B" });
  });

  it("handles empty array", () => {
    expect(deduplicateSlugs([])).toStrictEqual([]);
  });

  it("handles single item", () => {
    expect(deduplicateSlugs([{ slug: "a" }])).toStrictEqual([{ slug: "a" }]);
  });
});

describe(deduplicateNormalizedTexts, () => {
  it("deduplicates text after punctuation and string normalization", () => {
    expect(deduplicateNormalizedTexts([" Bonjour ! ", "Bonjour!", "Oi", "oi "])).toStrictEqual([
      "Bonjour!",
      "oi",
    ]);
  });

  it("keeps the first key order while preserving the latest display text", () => {
    expect(deduplicateNormalizedTexts(["Olá", "Oi", "Ola"])).toStrictEqual(["Ola", "Oi"]);
  });
});

describe(normalizePunctuation, () => {
  it("removes space before exclamation mark", () => {
    expect(normalizePunctuation("Hello !")).toBe("Hello!");
  });

  it("removes space before question mark", () => {
    expect(normalizePunctuation("Comment ?")).toBe("Comment?");
  });

  it("removes space before period", () => {
    expect(normalizePunctuation("Fin .")).toBe("Fin.");
  });

  it("removes multiple spaces before punctuation", () => {
    expect(normalizePunctuation("Hello  !")).toBe("Hello!");
  });

  it("leaves already-correct text unchanged", () => {
    expect(normalizePunctuation("Hello!")).toBe("Hello!");
  });

  it("handles CJK punctuation", () => {
    expect(normalizePunctuation("これは何 ？")).toBe("これは何？");
  });

  it("handles Arabic question mark", () => {
    expect(normalizePunctuation("مرحبا ؟")).toBe("مرحبا؟");
  });

  it("handles empty string", () => {
    expect(normalizePunctuation("")).toBe("");
  });

  it("handles multiple punctuation in one sentence", () => {
    expect(normalizePunctuation("Bonjour , comment allez-vous ?")).toBe(
      "Bonjour, comment allez-vous?",
    );
  });
});

describe(segmentWords, () => {
  it("splits space-delimited text by spaces", () => {
    expect(segmentWords("Hola mundo")).toStrictEqual(["Hola", "mundo"]);
    expect(segmentWords("Yo veo un gato.")).toStrictEqual(["Yo", "veo", "un", "gato."]);
  });

  it("segments Japanese text into individual words", () => {
    const result = segmentWords("あのやまはきれいです");
    expect(result.length).toBeGreaterThan(1);
    expect(result).toContain("あの");
    expect(result).toContain("きれい");
    expect(result).toContain("です");
  });

  it("segments Chinese text into individual words", () => {
    const result = segmentWords("猫吃鱼");
    expect(result.length).toBeGreaterThan(1);
  });

  it("handles single word", () => {
    expect(segmentWords("hello")).toStrictEqual(["hello"]);
    expect(segmentWords("猫")).toStrictEqual(["猫"]);
  });

  it("handles empty string", () => {
    expect(segmentWords("")).toStrictEqual([]);
  });

  it("filters empty tokens from consecutive spaces", () => {
    expect(segmentWords("hello  world")).toStrictEqual(["hello", "world"]);
    expect(segmentWords("a  b  c")).toStrictEqual(["a", "b", "c"]);
  });

  it("attaches French-style punctuation to preceding word", () => {
    expect(segmentWords("Comment allez-vous ?")).toStrictEqual(["Comment", "allez-vous?"]);
    expect(segmentWords("Bonjour !")).toStrictEqual(["Bonjour!"]);
  });

  it("handles multiple French-style punctuation in one sentence", () => {
    expect(segmentWords("Oui , je suis là !")).toStrictEqual(["Oui,", "je", "suis", "là!"]);
  });

  it("keeps connector-linked tokens intact without spaces", () => {
    expect(segmentWords("gato-prueba")).toStrictEqual(["gato-prueba"]);
    expect(segmentWords("l'heure")).toStrictEqual(["l'heure"]);
    expect(segmentWords("allez-vous?")).toStrictEqual(["allez-vous?"]);
  });

  it("keeps surrounding punctuation on non-space tokens", () => {
    expect(segmentWords("¿Hola?")).toStrictEqual(["¿Hola?"]);
  });
});

describe(stripPunctuation, () => {
  it("removes punctuation from text", () => {
    expect(stripPunctuation("hello!")).toBe("hello");
    expect(stripPunctuation("world?")).toBe("world");
    expect(stripPunctuation("a,b.c")).toBe("abc");
  });

  it("preserves letters, numbers, and spaces", () => {
    expect(stripPunctuation("hello world 123")).toBe("hello world 123");
  });

  it("preserves unicode letters", () => {
    expect(stripPunctuation("café")).toBe("café");
    expect(stripPunctuation("猫")).toBe("猫");
    expect(stripPunctuation("고양이")).toBe("고양이");
  });

  it("handles empty string", () => {
    expect(stripPunctuation("")).toBe("");
  });
});

describe(extractUniqueSentenceWords, () => {
  it("extracts unique lowercase words from sentences", () => {
    const result = extractUniqueSentenceWords(["Hola mundo", "Buenos dias"]);
    expect(result).toStrictEqual(["hola", "mundo", "buenos", "dias"]);
  });

  it("deduplicates words across sentences", () => {
    const result = extractUniqueSentenceWords(["gato bonito", "gato grande"]);
    expect(result).toContain("gato");
    expect(result.filter((word) => word === "gato")).toHaveLength(1);
  });

  it("strips punctuation from words", () => {
    const result = extractUniqueSentenceWords(["Hola, como estas?"]);
    expect(result).toContain("hola");
    expect(result).toContain("como");
    expect(result).toContain("estas");
    expect(result).not.toContain("estas?");
  });

  it("filters out empty tokens", () => {
    const result = extractUniqueSentenceWords(["hello  world"]);
    expect(result).not.toContain("");
  });

  it("returns empty array for empty input", () => {
    expect(extractUniqueSentenceWords([])).toStrictEqual([]);
  });

  it("handles non-space-delimited text via Intl.Segmenter", () => {
    const result = extractUniqueSentenceWords(["猫は食べる"]);
    expect(result.length).toBeGreaterThan(1);
    expect(result).toContain("猫");
    expect(result).toContain("食べる");
  });
});

describe(replaceNamePlaceholder, () => {
  it("replaces {{NAME}} with provided name", () => {
    expect(replaceNamePlaceholder("Hello, {{NAME}}!", "Alice")).toBe("Hello, Alice!");
  });

  it("handles multiple occurrences", () => {
    expect(replaceNamePlaceholder("{{NAME}}, meet {{NAME}}", "Bob")).toBe("Bob, meet Bob");
  });

  it("strips '{{NAME}}, ' pattern when name is null", () => {
    expect(replaceNamePlaceholder("{{NAME}}, I think we have a problem.", null)).toBe(
      "I think we have a problem.",
    );
  });

  it("strips ', {{NAME}}' pattern when name is null", () => {
    expect(replaceNamePlaceholder("Hello there, {{NAME}}", null)).toBe("Hello there");
  });

  it("strips standalone {{NAME}} when name is null", () => {
    expect(replaceNamePlaceholder("{{NAME}} welcome back", null)).toBe("Welcome back");
  });

  it("capitalizes first letter after stripping leading {{NAME}} with comma", () => {
    expect(replaceNamePlaceholder("{{NAME}}, welcome back!", null)).toBe("Welcome back!");
  });

  it("does not double-capitalize when remainder already starts uppercase", () => {
    expect(replaceNamePlaceholder("{{NAME}}, I think we have a problem.", null)).toBe(
      "I think we have a problem.",
    );
  });

  it("returns original text when no placeholder present", () => {
    expect(replaceNamePlaceholder("No placeholder here", "Alice")).toBe("No placeholder here");
    expect(replaceNamePlaceholder("No placeholder here", null)).toBe("No placeholder here");
  });
});
