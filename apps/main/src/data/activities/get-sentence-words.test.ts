import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonSentenceFixture } from "@zoonk/testing/fixtures/lesson-sentences";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, describe, expect, test } from "vitest";
import { getSentenceWords } from "./get-sentence-words";

describe(getSentenceWords, () => {
  let org: Awaited<ReturnType<typeof organizationFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    org = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
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
  });

  test("returns Word records matching words found in lesson sentences", async () => {
    const uniqueId = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "es",
      organizationId: org.id,
    });

    const wordText1 = `hola${uniqueId}`;
    const wordText2 = `mundo${uniqueId}`;

    const [sentence, word1, word2] = await Promise.all([
      sentenceFixture({
        organizationId: org.id,
        sentence: `${wordText1} ${wordText2}`,
        targetLanguage: "es",
        translation: "hello world",
      }),
      wordFixture({
        organizationId: org.id,
        targetLanguage: "es",
        translation: "hello",
        word: wordText1,
      }),
      wordFixture({
        organizationId: org.id,
        targetLanguage: "es",
        translation: "world",
        word: wordText2,
      }),
    ]);

    await lessonSentenceFixture({ lessonId: newLesson.id, sentenceId: sentence.id });

    const result = await getSentenceWords({ lessonId: newLesson.id });

    expect(result).toHaveLength(2);

    const words = result.map((item) => item.word);
    expect(words).toContain(word1.word);
    expect(words).toContain(word2.word);
  });

  test("returns empty array when lesson has no sentences", async () => {
    const emptyLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "es",
      organizationId: org.id,
    });

    const result = await getSentenceWords({ lessonId: emptyLesson.id });
    expect(result).toEqual([]);
  });

  test("returns empty array for non-existent lesson", async () => {
    const result = await getSentenceWords({ lessonId: 999_999 });
    expect(result).toEqual([]);
  });

  test("returns empty when sentence words have no matching Word records", async () => {
    const uniqueId = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "es",
      organizationId: org.id,
    });

    const sentence = await sentenceFixture({
      organizationId: org.id,
      sentence: `noexiste${uniqueId} tampoco${uniqueId}`,
      targetLanguage: "es",
      translation: "doesn't exist either",
    });

    await lessonSentenceFixture({ lessonId: newLesson.id, sentenceId: sentence.id });

    const result = await getSentenceWords({ lessonId: newLesson.id });
    expect(result).toEqual([]);
  });

  test("strips punctuation when matching sentence words to Word records", async () => {
    const uniqueId = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
    const wordText = `sabes${uniqueId}`;
    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "es",
      organizationId: org.id,
    });

    const [sentence, word] = await Promise.all([
      sentenceFixture({
        organizationId: org.id,
        sentence: `${wordText}?`,
        targetLanguage: "es",
        translation: "you know?",
      }),
      wordFixture({
        organizationId: org.id,
        targetLanguage: "es",
        translation: "you know",
        word: wordText,
      }),
    ]);

    await lessonSentenceFixture({ lessonId: newLesson.id, sentenceId: sentence.id });

    const result = await getSentenceWords({ lessonId: newLesson.id });

    expect(result).toHaveLength(1);
    expect(result[0]?.word).toBe(word.word);
  });

  test("deduplicates words across multiple sentences", async () => {
    const uniqueId = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
    const wordText = `gato${uniqueId}`;
    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "es",
      organizationId: org.id,
    });

    const [sentence1, sentence2, word] = await Promise.all([
      sentenceFixture({
        organizationId: org.id,
        sentence: `${wordText} bonito`,
        targetLanguage: "es",
        translation: "pretty cat",
      }),
      sentenceFixture({
        organizationId: org.id,
        sentence: `${wordText} grande`,
        targetLanguage: "es",
        translation: "big cat",
      }),
      wordFixture({
        organizationId: org.id,
        targetLanguage: "es",
        translation: "cat",
        word: wordText,
      }),
    ]);

    await Promise.all([
      lessonSentenceFixture({ lessonId: newLesson.id, sentenceId: sentence1.id }),
      lessonSentenceFixture({ lessonId: newLesson.id, sentenceId: sentence2.id }),
    ]);

    const result = await getSentenceWords({ lessonId: newLesson.id });

    const matchingWords = result.filter((item) => item.word === word.word);
    expect(matchingWords).toHaveLength(1);
  });
});
