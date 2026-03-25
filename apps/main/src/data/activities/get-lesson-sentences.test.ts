import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonSentenceFixture } from "@zoonk/testing/fixtures/lesson-sentences";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { sentenceFixture, sentenceTranslationFixture } from "@zoonk/testing/fixtures/sentences";
import { beforeAll, describe, expect, test } from "vitest";
import { getLessonSentences } from "./get-lesson-sentences";

describe(getLessonSentences, () => {
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

  test("returns sentences linked via LessonSentence junction", async () => {
    const [sentence1, sentence2] = await Promise.all([
      sentenceFixture({
        organizationId: org.id,
        sentence: `Hola mundo ${crypto.randomUUID()}`,
        targetLanguage: "es",
      }),
      sentenceFixture({
        organizationId: org.id,
        sentence: `Buenos días ${crypto.randomUUID()}`,
        targetLanguage: "es",
      }),
    ]);

    await Promise.all([
      lessonSentenceFixture({ lessonId: lesson.id, sentenceId: sentence1.id }),
      lessonSentenceFixture({ lessonId: lesson.id, sentenceId: sentence2.id }),
    ]);

    const result = await getLessonSentences({ lessonId: lesson.id });

    expect(result).toHaveLength(2);

    const ids = result.map((item) => item.id);
    expect(ids).toContain(sentence1.id);
    expect(ids).toContain(sentence2.id);
  });

  test("returns all expected fields", async () => {
    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "es",
      organizationId: org.id,
    });

    const sentence = await sentenceFixture({
      alternativeSentences: ["Adoro"],
      audioUrl: "https://example.com/megusta.mp3",
      organizationId: org.id,
      romanization: null,
      sentence: `Me gusta ${crypto.randomUUID()}`,
      targetLanguage: "es",
    });

    await sentenceTranslationFixture({
      alternativeTranslations: ["I enjoy"],
      sentenceId: sentence.id,
      translation: "I like",
      userLanguage: "en",
    });

    await lessonSentenceFixture({ lessonId: newLesson.id, sentenceId: sentence.id });

    const result = await getLessonSentences({ lessonId: newLesson.id });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      alternativeSentences: ["Adoro"],
      audioUrl: "https://example.com/megusta.mp3",
      id: sentence.id,
      romanization: null,
      sentence: sentence.sentence,
      translations: expect.arrayContaining([
        expect.objectContaining({
          alternativeTranslations: ["I enjoy"],
          translation: "I like",
        }),
      ]) as unknown,
    });
  });

  test("returns empty array when lesson has no sentences", async () => {
    const emptyLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "es",
      organizationId: org.id,
    });

    const result = await getLessonSentences({ lessonId: emptyLesson.id });
    expect(result).toEqual([]);
  });

  test("returns empty array for non-existent lesson", async () => {
    const result = await getLessonSentences({ lessonId: 999_999 });
    expect(result).toEqual([]);
  });
});
