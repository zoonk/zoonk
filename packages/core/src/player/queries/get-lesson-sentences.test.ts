import { randomUUID } from "node:crypto";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { lessonSentenceFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { beforeAll, describe, expect, test } from "vitest";
import { getLessonSentencesForLessons } from "./get-lesson-sentences";

describe(getLessonSentencesForLessons, () => {
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

    const result = await getLessonSentencesForLessons({ lessonIds: [lesson.id] });

    expect(result).toHaveLength(2);

    const sentenceIds = result.map((item) => item.sentenceId);
    expect(sentenceIds).toContain(sentence1.id);
    expect(sentenceIds).toContain(sentence2.id);
  });

  test("returns all expected fields", async () => {
    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "es",
      organizationId: org.id,
    });

    const sentence = await sentenceFixture({
      audioUrl: "https://example.com/megusta.mp3",
      organizationId: org.id,
      romanization: null,
      sentence: `Me gusta ${crypto.randomUUID()}`,
      targetLanguage: "es",
    });

    await lessonSentenceFixture({
      distractors: ["Adoro"],
      lessonId: newLesson.id,
      sentenceId: sentence.id,
      translation: "I like",
      translationDistractors: ["I enjoy"],
      userLanguage: "en",
    });

    const result = await getLessonSentencesForLessons({ lessonIds: [newLesson.id] });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      distractors: ["Adoro"],
      sentence: expect.objectContaining({
        audioUrl: "https://example.com/megusta.mp3",
        id: sentence.id,
        romanization: null,
        sentence: sentence.sentence,
      }) as unknown,
      translation: "I like",
      translationDistractors: ["I enjoy"],
      userLanguage: "en",
    });
  });

  test("returns empty array when lesson has no sentences", async () => {
    const emptyLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "es",
      organizationId: org.id,
    });

    const result = await getLessonSentencesForLessons({ lessonIds: [emptyLesson.id] });
    expect(result).toEqual([]);
  });

  test("returns empty array for non-existent lesson", async () => {
    const result = await getLessonSentencesForLessons({ lessonIds: [randomUUID()] });
    expect(result).toEqual([]);
  });
});
