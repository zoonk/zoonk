import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { lessonSentenceFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { lessonWordFixture, wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, describe, expect, test } from "vitest";
import { getFallbackDistractorWords } from "./get-fallback-distractor-words";

describe(getFallbackDistractorWords, () => {
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;
  let org: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    org = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      targetLanguage: "es",
    });

    chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
    });
  });

  test("returns up to four extra words and excludes lesson word ids", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
    });

    const lessonWord = await wordFixture({
      organizationId: org.id,
      targetLanguage: "es",
      word: `hola-${crypto.randomUUID()}`,
    });

    await lessonWordFixture({ lessonId: lesson.id, wordId: lessonWord.id });

    // Fallback distractors come from LessonWord records in OTHER lessons,
    // so create a separate lesson to hold the extra words.
    const otherLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
    });

    const extraWords = await Promise.all(
      Array.from({ length: 6 }, async (_, index) => {
        const word = await wordFixture({
          organizationId: org.id,
          targetLanguage: "es",
          word: `word-${index}-${crypto.randomUUID()}`,
        });

        await lessonWordFixture({ lessonId: otherLesson.id, wordId: word.id });
        return word;
      }),
    );

    const otherOrg = await organizationFixture({ kind: "brand" });
    const otherOrgWord = await wordFixture({
      organizationId: otherOrg.id,
      targetLanguage: "es",
      word: `otro-${crypto.randomUUID()}`,
    });

    const otherOrgCourse = await courseFixture({
      isPublished: true,
      organizationId: otherOrg.id,
      targetLanguage: "es",
    });
    const otherOrgChapter = await chapterFixture({
      courseId: otherOrgCourse.id,
      isPublished: true,
      organizationId: otherOrg.id,
    });
    const otherOrgLesson = await lessonFixture({
      chapterId: otherOrgChapter.id,
      isPublished: true,
      organizationId: otherOrg.id,
    });

    await lessonWordFixture({ lessonId: otherOrgLesson.id, wordId: otherOrgWord.id });

    const result = await getFallbackDistractorWords({ lessonId: lesson.id });

    expect(result).toHaveLength(4);
    expect(result.map((lw) => lw.wordId)).not.toContain(lessonWord.id);
    expect(result.every((lw) => extraWords.some((extraWord) => extraWord.id === lw.wordId))).toBe(
      true,
    );
  });

  test("uses sentence language scope when there are no lesson words", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
    });

    const sentence = await sentenceFixture({
      organizationId: org.id,
      sentence: `hola-${crypto.randomUUID()} mundo-${crypto.randomUUID()}`,
      targetLanguage: "es",
    });

    await lessonSentenceFixture({ lessonId: lesson.id, sentenceId: sentence.id });

    // Create a word in another lesson so it shows up as a fallback distractor
    const otherLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
    });

    const scopedWord = await wordFixture({
      organizationId: org.id,
      targetLanguage: "es",
      word: `gato-${crypto.randomUUID()}`,
    });

    await lessonWordFixture({ lessonId: otherLesson.id, wordId: scopedWord.id });

    // Wrong target language — should not appear
    const frWord = await wordFixture({
      organizationId: org.id,
      targetLanguage: "fr",
      word: `chat-${crypto.randomUUID()}`,
    });

    const frCourse = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      targetLanguage: "fr",
    });
    const frChapter = await chapterFixture({
      courseId: frCourse.id,
      isPublished: true,
      organizationId: org.id,
    });
    const frLesson = await lessonFixture({
      chapterId: frChapter.id,
      isPublished: true,
      organizationId: org.id,
    });

    await lessonWordFixture({ lessonId: frLesson.id, wordId: frWord.id });

    const result = await getFallbackDistractorWords({ lessonId: lesson.id, limit: 10 });

    expect(result.map((lw) => lw.wordId)).toContain(scopedWord.id);
  });

  test("returns empty array when there is no lesson scope to derive fallback words from", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
    });

    const result = await getFallbackDistractorWords({ lessonId: lesson.id });
    expect(result).toEqual([]);
  });
});
