import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonWordFixture } from "@zoonk/testing/fixtures/lesson-words";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { wordFixture } from "@zoonk/testing/fixtures/words";
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
        pronunciation: "oh-lah",
        targetLanguage: "es",
        translation: "hello",
        word: `hola-${crypto.randomUUID()}`,
      }),
      wordFixture({
        organizationId: org.id,
        pronunciation: "grah-see-ahs",
        targetLanguage: "es",
        translation: "thank you",
        word: `gracias-${crypto.randomUUID()}`,
      }),
    ]);

    await Promise.all([
      lessonWordFixture({ lessonId: lesson.id, wordId: word1.id }),
      lessonWordFixture({ lessonId: lesson.id, wordId: word2.id }),
    ]);

    const result = await getLessonWords({ lessonId: lesson.id });

    expect(result).toHaveLength(2);

    const ids = result.map((item) => item.id);
    expect(ids).toContain(word1.id);
    expect(ids).toContain(word2.id);
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
      pronunciation: "peh-roh",
      romanization: null,
      targetLanguage: "es",
      translation: "dog",
      word: `perro-${crypto.randomUUID()}`,
    });

    await lessonWordFixture({ lessonId: newLesson.id, wordId: word.id });

    const result = await getLessonWords({ lessonId: newLesson.id });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      alternativeTranslations: [],
      audioUrl: "https://example.com/perro.mp3",
      id: word.id,
      pronunciation: "peh-roh",
      romanization: null,
      translation: "dog",
      word: word.word,
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
