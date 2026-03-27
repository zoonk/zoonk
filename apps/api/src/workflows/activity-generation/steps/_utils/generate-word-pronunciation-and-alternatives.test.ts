import { generateActivityPronunciation } from "@zoonk/ai/tasks/activities/language/pronunciation";
import { generateWordAlternativeTranslations } from "@zoonk/ai/tasks/activities/language/word-alternative-translations";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateWordPronunciationAndAlternatives } from "./generate-word-pronunciation-and-alternatives";

vi.mock("@zoonk/ai/tasks/activities/language/pronunciation", () => ({
  generateActivityPronunciation: vi.fn().mockResolvedValue({
    data: { pronunciation: "OH-lah" },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/word-alternative-translations", () => ({
  generateWordAlternativeTranslations: vi.fn().mockResolvedValue({
    data: { alternativeTranslations: ["hi", "hey"] },
  }),
}));

/**
 * Creates a WordPronunciation record for testing the "existing pronunciation" path.
 */
async function createWordPronunciation(attrs: {
  pronunciation?: string;
  userLanguage?: string;
  wordId: bigint;
}) {
  return prisma.wordPronunciation.create({
    data: {
      pronunciation: attrs.pronunciation ?? "test-pronunciation",
      userLanguage: attrs.userLanguage ?? "en",
      wordId: attrs.wordId,
    },
  });
}

/**
 * Creates a LessonWord record with lesson-scoped translation data.
 * Translations live on LessonWord because the same word can have different
 * meanings in different lessons.
 */
async function createLessonWord(attrs: {
  alternativeTranslations?: string[];
  lessonId: number;
  translation: string;
  userLanguage?: string;
  wordId: bigint;
}) {
  return prisma.lessonWord.create({
    data: {
      alternativeTranslations: attrs.alternativeTranslations ?? [],
      lessonId: attrs.lessonId,
      translation: attrs.translation,
      userLanguage: attrs.userLanguage ?? "en",
      wordId: attrs.wordId,
    },
  });
}

describe(generateWordPronunciationAndAlternatives, () => {
  let organizationId: number;
  let lessonId: number;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;

    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({ courseId: course.id, organizationId });
    const lesson = await lessonFixture({ chapterId: chapter.id, organizationId });
    lessonId = lesson.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns empty results when words array is empty", async () => {
    const result = await generateWordPronunciationAndAlternatives({
      lessonId,
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [],
    });

    expect(result).toEqual({ alternatives: {}, pronunciations: {} });
    expect(generateActivityPronunciation).not.toHaveBeenCalled();
    expect(generateWordAlternativeTranslations).not.toHaveBeenCalled();
  });

  test("generates pronunciation and returns it without writing to the database", async () => {
    const word = await wordFixture({ organizationId });
    await createLessonWord({ lessonId, translation: "hello", wordId: word.id });

    const result = await generateWordPronunciationAndAlternatives({
      lessonId,
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word }],
    });

    expect(result.pronunciations[word.word]).toBe("OH-lah");
    expect(generateActivityPronunciation).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguage: "es", userLanguage: "en", word: word.word }),
    );

    // Verify the function did NOT write to the database
    const dbRecord = await prisma.wordPronunciation.findFirst({
      where: { userLanguage: "en", wordId: word.id },
    });

    expect(dbRecord).toBeNull();
  });

  test("generates alternativeTranslations and returns them without writing to the database", async () => {
    const word = await wordFixture({ organizationId });
    await createLessonWord({ lessonId, translation: "hello", wordId: word.id });

    const result = await generateWordPronunciationAndAlternatives({
      lessonId,
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word }],
    });

    expect(result.alternatives[word.word]).toEqual(["hi", "hey"]);
    expect(generateWordAlternativeTranslations).toHaveBeenCalledWith(
      expect.objectContaining({
        targetLanguage: "es",
        translation: "hello",
        userLanguage: "en",
        word: word.word,
      }),
    );

    // Verify the function did NOT write to the database
    const dbRecord = await prisma.lessonWord.findFirst({
      where: { lessonId, wordId: word.id },
    });

    expect(dbRecord?.alternativeTranslations).toEqual([]);
  });

  test("skips pronunciation generation for words that already have it", async () => {
    const word = await wordFixture({ organizationId });
    await Promise.all([
      createWordPronunciation({ pronunciation: "existing-pron", wordId: word.id }),
      createLessonWord({ lessonId, translation: "cat", wordId: word.id }),
    ]);

    await generateWordPronunciationAndAlternatives({
      lessonId,
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word }],
    });

    expect(generateActivityPronunciation).not.toHaveBeenCalled();
  });

  test("skips alternatives generation for words that already have them", async () => {
    const word = await wordFixture({ organizationId });
    await createLessonWord({
      alternativeTranslations: ["existing-alt"],
      lessonId,
      translation: "good evening",
      wordId: word.id,
    });

    await generateWordPronunciationAndAlternatives({
      lessonId,
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word }],
    });

    expect(generateWordAlternativeTranslations).not.toHaveBeenCalled();
  });

  test("skips both when word already has pronunciation and alternatives", async () => {
    const word = await wordFixture({ organizationId });
    await Promise.all([
      createWordPronunciation({ pronunciation: "BOH-ah NOY-chee", wordId: word.id }),
      createLessonWord({
        alternativeTranslations: ["good night"],
        lessonId,
        translation: "good evening",
        wordId: word.id,
      }),
    ]);

    const result = await generateWordPronunciationAndAlternatives({
      lessonId,
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word }],
    });

    expect(generateActivityPronunciation).not.toHaveBeenCalled();
    expect(generateWordAlternativeTranslations).not.toHaveBeenCalled();
    expect(result).toEqual({ alternatives: {}, pronunciations: {} });
  });

  test("returns alternatives even when pronunciation AI fails", async () => {
    vi.mocked(generateActivityPronunciation).mockRejectedValueOnce(
      new Error("pronunciation AI failed"),
    );

    const word = await wordFixture({ organizationId });
    await createLessonWord({ lessonId, translation: "hello", wordId: word.id });

    const result = await generateWordPronunciationAndAlternatives({
      lessonId,
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word }],
    });

    expect(result.alternatives[word.word]).toEqual(["hi", "hey"]);
    expect(result.pronunciations[word.word]).toBeUndefined();
  });

  test("returns pronunciation even when alternatives AI fails", async () => {
    vi.mocked(generateWordAlternativeTranslations).mockRejectedValueOnce(
      new Error("alternatives AI failed"),
    );

    const word = await wordFixture({ organizationId });
    await createLessonWord({ lessonId, translation: "hello", wordId: word.id });

    const result = await generateWordPronunciationAndAlternatives({
      lessonId,
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word }],
    });

    expect(result.pronunciations[word.word]).toBe("OH-lah");
    expect(result.alternatives[word.word]).toBeUndefined();
  });

  test("returns generated pronunciation and alternatives in the result", async () => {
    const word = await wordFixture({ organizationId });
    await createLessonWord({ lessonId, translation: "hello", wordId: word.id });

    const result = await generateWordPronunciationAndAlternatives({
      lessonId,
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word }],
    });

    expect(result.pronunciations[word.word]).toBe("OH-lah");
    expect(result.alternatives[word.word]).toEqual(["hi", "hey"]);
  });

  test("generates pronunciation and alternatives for multiple words in a single call", async () => {
    const [word1, word2] = await Promise.all([
      wordFixture({ organizationId }),
      wordFixture({ organizationId }),
    ]);

    await Promise.all([
      createLessonWord({ lessonId, translation: "hello", wordId: word1.id }),
      createLessonWord({ lessonId, translation: "cat", wordId: word2.id }),
    ]);

    const result = await generateWordPronunciationAndAlternatives({
      lessonId,
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word1.word }, { word: word2.word }],
    });

    expect(Object.keys(result.pronunciations)).toHaveLength(2);
    expect(Object.keys(result.alternatives)).toHaveLength(2);
    expect(generateActivityPronunciation).toHaveBeenCalledTimes(2);
    expect(generateWordAlternativeTranslations).toHaveBeenCalledTimes(2);
  });

  test("only generates missing fields in a mixed batch", async () => {
    const [needsBoth, needsPronOnly, needsAltsOnly] = await Promise.all([
      wordFixture({ organizationId }),
      wordFixture({ organizationId }),
      wordFixture({ organizationId }),
    ]);

    await Promise.all([
      createLessonWord({
        lessonId,
        translation: "hello",
        wordId: needsBoth.id,
      }),
      createLessonWord({
        alternativeTranslations: ["kitty"],
        lessonId,
        translation: "cat",
        wordId: needsPronOnly.id,
      }),
      createWordPronunciation({
        pronunciation: "existing-pron",
        wordId: needsAltsOnly.id,
      }),
      createLessonWord({
        lessonId,
        translation: "dog",
        wordId: needsAltsOnly.id,
      }),
    ]);

    await generateWordPronunciationAndAlternatives({
      lessonId,
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: needsBoth.word }, { word: needsPronOnly.word }, { word: needsAltsOnly.word }],
    });

    // Pronunciation: called for needsBoth + needsPronOnly (2), not needsAltsOnly
    expect(generateActivityPronunciation).toHaveBeenCalledTimes(2);

    // Alternatives: called for needsBoth + needsAltsOnly (2), not needsPronOnly
    expect(generateWordAlternativeTranslations).toHaveBeenCalledTimes(2);
  });

  test("generates pronunciation for words not yet in the database", async () => {
    const result = await generateWordPronunciationAndAlternatives({
      lessonId,
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: "completamente-nuevo" }],
    });

    expect(generateActivityPronunciation).toHaveBeenCalledWith(
      expect.objectContaining({ word: "completamente-nuevo" }),
    );
    expect(result.pronunciations["completamente-nuevo"]).toBe("OH-lah");
  });

  test("generates alternatives for new words when translation is provided", async () => {
    const result = await generateWordPronunciationAndAlternatives({
      lessonId,
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ translation: "completely", word: "completamente-con-trad" }],
    });

    expect(generateWordAlternativeTranslations).toHaveBeenCalledWith(
      expect.objectContaining({
        translation: "completely",
        word: "completamente-con-trad",
      }),
    );
    expect(result.alternatives["completamente-con-trad"]).toEqual(["hi", "hey"]);
  });

  test("skips alternatives for new words without translation", async () => {
    await generateWordPronunciationAndAlternatives({
      lessonId,
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: "sin-traduccion" }],
    });

    // Pronunciation should still be generated
    expect(generateActivityPronunciation).toHaveBeenCalledOnce();
    // No translation provided → alternatives skipped
    expect(generateWordAlternativeTranslations).not.toHaveBeenCalled();
  });

  test("skips pronunciation AI for words that have WordPronunciation but no LessonWord in the current lesson", async () => {
    const word = await wordFixture({ organizationId });

    // Word has pronunciation from a prior lesson but no LessonWord in this lesson
    await createWordPronunciation({ pronunciation: "BAHN-koh", wordId: word.id });

    await generateWordPronunciationAndAlternatives({
      lessonId,
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ translation: "bank", word: word.word }],
    });

    // Pronunciation already exists in WordPronunciation — should NOT regenerate via AI
    expect(generateActivityPronunciation).not.toHaveBeenCalled();
  });
});
