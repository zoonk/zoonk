import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonSentenceFixture } from "@zoonk/testing/fixtures/lesson-sentences";
import { lessonWordFixture } from "@zoonk/testing/fixtures/lesson-words";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { wordFixture } from "@zoonk/testing/fixtures/words";
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
      translation: `hello-${crypto.randomUUID()}`,
      userLanguage: "en",
      word: `hola-${crypto.randomUUID()}`,
    });
    await lessonWordFixture({ lessonId: lesson.id, wordId: lessonWord.id });

    const extraWords = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        wordFixture({
          organizationId: org.id,
          targetLanguage: "es",
          translation: `extra-${index}-${crypto.randomUUID()}`,
          userLanguage: "en",
          word: `word-${index}-${crypto.randomUUID()}`,
        }),
      ),
    );

    const otherOrg = await organizationFixture({ kind: "brand" });
    await wordFixture({
      organizationId: otherOrg.id,
      targetLanguage: "es",
      translation: `other-org-${crypto.randomUUID()}`,
      userLanguage: "en",
      word: `otro-${crypto.randomUUID()}`,
    });

    const result = await getFallbackDistractorWords({ lessonId: lesson.id });

    expect(result).toHaveLength(4);
    expect(result.map((word) => word.id)).not.toContain(lessonWord.id);
    expect(result.every((word) => extraWords.some((extraWord) => extraWord.id === word.id))).toBe(
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
      translation: `hello-${crypto.randomUUID()} world-${crypto.randomUUID()}`,
      userLanguage: "en",
    });
    await lessonSentenceFixture({ lessonId: lesson.id, sentenceId: sentence.id });

    const scopedWord = await wordFixture({
      organizationId: org.id,
      targetLanguage: "es",
      translation: `cat-${crypto.randomUUID()}`,
      userLanguage: "en",
      word: `gato-${crypto.randomUUID()}`,
    });

    await wordFixture({
      organizationId: org.id,
      targetLanguage: "fr",
      translation: `cat-${crypto.randomUUID()}`,
      userLanguage: "en",
      word: `chat-${crypto.randomUUID()}`,
    });

    const result = await getFallbackDistractorWords({ lessonId: lesson.id, limit: 10 });

    expect(result.map((word) => word.id)).toContain(scopedWord.id);
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
