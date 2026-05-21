import { randomUUID } from "node:crypto";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import {
  chapterWordFixture,
  wordFixture,
  wordPronunciationFixture,
} from "@zoonk/testing/fixtures/words";
import { beforeAll, describe, expect, it } from "vitest";
import { getChapterWordsForIds } from "./get-chapter-words";

describe(getChapterWordsForIds, () => {
  let org: Awaited<ReturnType<typeof organizationFixture>>;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;

  beforeAll(async () => {
    org = await organizationFixture({ kind: "brand" });

    course = await courseFixture({ isPublished: true, language: "es", organizationId: org.id });

    chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      language: "es",
      organizationId: org.id,
    });

    lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "es",
      organizationId: org.id,
    });
  });

  it("returns words linked via ChapterWord junction", async () => {
    const [word1, word2] = await Promise.all([
      wordFixture({
        organizationId: org.id,
        targetLanguage: "es",
        word: `hola-${crypto.randomUUID()}`,
      }),
      wordFixture({
        organizationId: org.id,
        targetLanguage: "es",
        word: `gracias-${crypto.randomUUID()}`,
      }),
    ]);

    const chapterWords = await Promise.all([
      chapterWordFixture({ sourceLessonId: lesson.id, wordId: word1.id }),
      chapterWordFixture({ sourceLessonId: lesson.id, wordId: word2.id }),
    ]);

    const result = await getChapterWordsForIds({
      chapterWordIds: chapterWords.map((chapterWord) => chapterWord.id),
    });

    expect(result).toHaveLength(2);

    const wordIds = result.map((item) => item.wordId);
    expect(wordIds).toContain(word1.id);
    expect(wordIds).toContain(word2.id);
  });

  it("returns all expected fields", async () => {
    const [newLesson, word] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        language: "es",
        organizationId: org.id,
      }),
      wordFixture({
        audioUrl: "https://example.com/perro.mp3",
        organizationId: org.id,
        romanization: null,
        targetLanguage: "es",
        word: `perro-${crypto.randomUUID()}`,
      }),
    ]);

    const [, chapterWord] = await Promise.all([
      wordPronunciationFixture({ pronunciation: "peh-roh", userLanguage: "en", wordId: word.id }),
      chapterWordFixture({
        distractors: [],
        sourceLessonId: newLesson.id,
        translation: "dog",
        userLanguage: "en",
        wordId: word.id,
      }),
    ]);

    const result = await getChapterWordsForIds({ chapterWordIds: [chapterWord.id] });

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      distractors: [],
      translation: "dog",
      userLanguage: "en",
      word: expect.objectContaining({
        audioUrl: "https://example.com/perro.mp3",
        id: word.id,
        pronunciations: expect.arrayContaining([
          expect.objectContaining({ pronunciation: "peh-roh" }),
        ]) as unknown,
        romanization: null,
        word: word.word,
      }) as unknown,
    });
  });

  it("returns empty array when no ids are requested", async () => {
    const result = await getChapterWordsForIds({ chapterWordIds: [] });
    expect(result).toStrictEqual([]);
  });

  it("returns empty array for non-existent chapter word", async () => {
    const result = await getChapterWordsForIds({ chapterWordIds: [randomUUID()] });
    expect(result).toStrictEqual([]);
  });

  it("only includes pronunciation matching the lesson's userLanguage", async () => {
    const [newLesson, word] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        language: "es",
        organizationId: org.id,
      }),
      wordFixture({
        organizationId: org.id,
        targetLanguage: "es",
        word: `banco-${crypto.randomUUID()}`,
      }),
    ]);

    // Create pronunciations for two different user languages
    const [chapterWord] = await Promise.all([
      chapterWordFixture({
        sourceLessonId: newLesson.id,
        translation: "bank",
        userLanguage: "en",
        wordId: word.id,
      }),
      wordPronunciationFixture({ pronunciation: "BAHN-koh", userLanguage: "en", wordId: word.id }),
      wordPronunciationFixture({ pronunciation: "BAN-co", userLanguage: "pt", wordId: word.id }),
    ]);

    const result = await getChapterWordsForIds({ chapterWordIds: [chapterWord.id] });

    // Should only include the English pronunciation (matching userLanguage
    // on the ChapterWord), not the Portuguese one
    expect(result[0]?.word.pronunciations).toHaveLength(1);
    expect(result[0]?.word.pronunciations[0]?.pronunciation).toBe("BAHN-koh");
  });
});
