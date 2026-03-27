import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import {
  lessonWordFixture,
  wordFixture,
  wordPronunciationFixture,
} from "@zoonk/testing/fixtures/words";
import { beforeAll, describe, expect, test } from "vitest";
import { getLessonWords } from "./get-lesson-words";

describe(getLessonWords, () => {
  let org: Awaited<ReturnType<typeof organizationFixture>>;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;

  beforeAll(async () => {
    org = await organizationFixture({ kind: "brand" });

    course = await courseFixture({
      isPublished: true,
      language: "es",
      organizationId: org.id,
    });

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

  test("returns words linked via LessonWord junction", async () => {
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

    await Promise.all([
      lessonWordFixture({ lessonId: lesson.id, wordId: word1.id }),
      lessonWordFixture({ lessonId: lesson.id, wordId: word2.id }),
    ]);

    const result = await getLessonWords({ lessonId: lesson.id });

    expect(result).toHaveLength(2);

    const wordIds = result.map((item) => item.wordId);
    expect(wordIds).toContain(word1.id);
    expect(wordIds).toContain(word2.id);
  });

  test("returns all expected fields", async () => {
    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "es",
      organizationId: org.id,
    });

    const word = await wordFixture({
      audioUrl: "https://example.com/perro.mp3",
      organizationId: org.id,
      romanization: null,
      targetLanguage: "es",
      word: `perro-${crypto.randomUUID()}`,
    });

    await wordPronunciationFixture({
      pronunciation: "peh-roh",
      userLanguage: "en",
      wordId: word.id,
    });

    await lessonWordFixture({
      alternativeTranslations: [],
      lessonId: newLesson.id,
      translation: "dog",
      userLanguage: "en",
      wordId: word.id,
    });

    const result = await getLessonWords({ lessonId: newLesson.id });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      alternativeTranslations: [],
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

  test("returns empty array when lesson has no words", async () => {
    const emptyLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "es",
      organizationId: org.id,
    });

    const result = await getLessonWords({ lessonId: emptyLesson.id });
    expect(result).toEqual([]);
  });

  test("returns empty array for non-existent lesson", async () => {
    const result = await getLessonWords({ lessonId: 999_999 });
    expect(result).toEqual([]);
  });
});
