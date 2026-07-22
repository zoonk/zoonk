import { randomUUID } from "node:crypto";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { chapterSentenceFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { beforeAll, describe, expect, it } from "vitest";
import { getChapterSentencesForIds } from "./get-chapter-sentences";

describe(getChapterSentencesForIds, () => {
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

  it("returns sentences linked via ChapterSentence junction", async () => {
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

    const chapterSentences = await Promise.all([
      chapterSentenceFixture({ sentenceId: sentence1.id, sourceLessonId: lesson.id }),
      chapterSentenceFixture({ sentenceId: sentence2.id, sourceLessonId: lesson.id }),
    ]);

    const result = await getChapterSentencesForIds(
      chapterSentences.map((chapterSentence) => chapterSentence.id),
    );

    expect(result).toHaveLength(2);

    const sentenceIds = result.map((item) => item.sentenceId);
    expect(sentenceIds).toContain(sentence1.id);
    expect(sentenceIds).toContain(sentence2.id);
  });

  it("returns all expected fields", async () => {
    const [newLesson, sentence] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        language: "es",
        organizationId: org.id,
      }),
      sentenceFixture({
        audioUrl: "https://example.com/megusta.mp3",
        organizationId: org.id,
        romanization: null,
        sentence: `Me gusta ${crypto.randomUUID()}`,
        targetLanguage: "es",
      }),
    ]);

    const chapterSentence = await chapterSentenceFixture({
      distractors: ["Adoro"],
      sentenceId: sentence.id,
      sourceLessonId: newLesson.id,
      translation: "I like",
      translationDistractors: ["I enjoy"],
      userLanguage: "en",
    });

    const result = await getChapterSentencesForIds([chapterSentence.id]);

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

  it("returns empty array when no ids are requested", async () => {
    const result = await getChapterSentencesForIds([]);
    expect(result).toStrictEqual([]);
  });

  it("returns empty array for non-existent chapter sentence", async () => {
    const result = await getChapterSentencesForIds([randomUUID()]);
    expect(result).toStrictEqual([]);
  });
});
