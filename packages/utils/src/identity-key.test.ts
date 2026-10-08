import { describe, expect, it } from "vitest";
import {
  assertIdentityKeyScope,
  buildChapterIdentityKey,
  buildImageReuseKey,
  buildLessonIdentityKey,
  buildSkillIdentityKey,
  buildSourceIdentityKey,
  normalizeIdentityText,
  scopeIdentityKey,
} from "./identity-key";

describe(normalizeIdentityText, () => {
  it("ignores case, accents, spacing and punctuation", () => {
    expect(normalizeIdentityText("  Regra de Três! ")).toBe("regra-de-tres");
    expect(normalizeIdentityText("regra   de tres")).toBe("regra-de-tres");
  });

  it("keeps letters and numbers from any script", () => {
    expect(normalizeIdentityText("日本語 N5")).toBe("日本語-n5");
    expect(normalizeIdentityText("Python 3.12")).toBe("python-3-12");
  });
});

describe(buildSkillIdentityKey, () => {
  it("gives equivalent names one key and keeps target languages apart", () => {
    expect(buildSkillIdentityKey({ name: "Calculate a Percentage", targetLanguage: null })).toBe(
      buildSkillIdentityKey({ name: "calculate a percentage.", targetLanguage: null }),
    );

    expect(buildSkillIdentityKey({ name: "Conjugate ser", targetLanguage: "es" })).not.toBe(
      buildSkillIdentityKey({ name: "Conjugate ser", targetLanguage: "pt" }),
    );
  });
});

describe(buildLessonIdentityKey, () => {
  it("is the same for the same skills in any order or repetition", () => {
    const first = buildLessonIdentityKey({
      courseId: "course",
      level: "beginner",
      skillIds: ["b", "a", "b"],
      targetLanguage: null,
    });

    expect(first).toBe(
      buildLessonIdentityKey({
        courseId: "course",
        level: "beginner",
        skillIds: ["a", "b"],
        targetLanguage: null,
      }),
    );

    expect(first).toBe("beginner::course:a+b");
  });

  it("separates levels and courses, and requires a skill", () => {
    const lesson = { courseId: "course", skillIds: ["a"], targetLanguage: null };

    expect(buildLessonIdentityKey({ ...lesson, level: "advanced" })).not.toBe(
      buildLessonIdentityKey({ ...lesson, level: "beginner" }),
    );

    expect(buildLessonIdentityKey({ ...lesson, courseId: "other", level: "beginner" })).not.toBe(
      buildLessonIdentityKey({ ...lesson, level: "beginner" }),
    );

    expect(buildLessonIdentityKey({ ...lesson, courseId: null, level: "overview" })).toBe(
      "overview:::a",
    );

    expect(() => buildLessonIdentityKey({ ...lesson, level: "beginner", skillIds: [] })).toThrow(
      "at least one skill",
    );
  });

  it("tells apart lessons that split one skill set by their normalized titles", () => {
    const lesson = { courseId: "course", level: "beginner", skillIds: ["a"], targetLanguage: null };
    const byDeclaration = buildLessonIdentityKey({ ...lesson, title: "Lançamento por declaração" });

    expect(byDeclaration).toBe("beginner::course:a:lancamento-por-declaracao");

    expect(buildLessonIdentityKey({ ...lesson, title: "lançamento  por declaração!" })).toBe(
      byDeclaration,
    );

    expect(buildLessonIdentityKey({ ...lesson, title: "Lançamento de ofício" })).not.toBe(
      byDeclaration,
    );

    expect(buildLessonIdentityKey({ ...lesson, title: null })).toBe(buildLessonIdentityKey(lesson));
  });
});

describe(buildChapterIdentityKey, () => {
  it("combines level, target language, course and the normalized title", () => {
    expect(
      buildChapterIdentityKey({
        courseId: "course",
        level: "overview",
        targetLanguage: "ja",
        title: "Hiragana Básico",
      }),
    ).toBe("overview:ja:course:hiragana-basico");
  });

  it("never gives the same title in another course the same key", () => {
    const chapter = { level: "beginner", targetLanguage: null, title: "Tema e informações" };

    expect(buildChapterIdentityKey({ ...chapter, courseId: "portuguese" })).not.toBe(
      buildChapterIdentityKey({ ...chapter, courseId: "foreign-reading" }),
    );
  });

  it("replaces keys too long for an index with their hash", () => {
    const key = buildChapterIdentityKey({
      courseId: "course",
      level: "beginner",
      targetLanguage: null,
      title: "word ".repeat(100),
    });

    expect(key).toMatch(/^sha256:[0-9a-f]{40}$/u);
  });
});

describe(buildSourceIdentityKey, () => {
  it("treats links to the same document as one source", () => {
    const canonical = buildSourceIdentityKey({
      contentHash: null,
      url: "https://www.gov.br/inep/edital?year=2026&utm_source=news#section",
    });

    expect(canonical).toBe("gov.br/inep/edital?year=2026");

    expect(
      buildSourceIdentityKey({ contentHash: null, url: "http://gov.br/inep/edital/?year=2026" }),
    ).toBe(canonical);
  });

  it("identifies uploads by content hash", () => {
    expect(buildSourceIdentityKey({ contentHash: "abc", url: null })).toBe("upload:abc");
    expect(() => buildSourceIdentityKey({ contentHash: null, url: null })).toThrow("URL");
  });
});

describe(buildImageReuseKey, () => {
  it("matches the same scene in the same style and label language only", () => {
    const scene = { language: null, prompt: "A red apple on a table", styleVersion: 2 };

    const key = buildImageReuseKey(scene);

    expect(buildImageReuseKey({ ...scene, prompt: "a red apple on a table." })).toBe(key);
    expect(buildImageReuseKey({ ...scene, styleVersion: 3 })).not.toBe(key);
    expect(buildImageReuseKey({ ...scene, language: "pt" })).not.toBe(key);
  });
});

describe(scopeIdentityKey, () => {
  it("puts private keys in their owner's key space", () => {
    expect(scopeIdentityKey({ key: "beginner::a", ownerId: null })).toBe("beginner::a");

    expect(scopeIdentityKey({ key: "beginner::a", ownerId: "user-1" })).toBe(
      "private:user-1:beginner::a",
    );
  });
});

describe(assertIdentityKeyScope, () => {
  it("rejects keys from another key space", () => {
    const privateKey = scopeIdentityKey({ key: "beginner::a", ownerId: "user-1" });

    expect(() => assertIdentityKeyScope({ key: privateKey, ownerId: "user-1" })).not.toThrow();
    expect(() => assertIdentityKeyScope({ key: "beginner::a", ownerId: null })).not.toThrow();
    expect(() => assertIdentityKeyScope({ key: privateKey, ownerId: null })).toThrow("key space");
    expect(() => assertIdentityKeyScope({ key: privateKey, ownerId: "user-2" })).toThrow();
    expect(() => assertIdentityKeyScope({ key: "beginner::a", ownerId: "user-1" })).toThrow();
  });
});
