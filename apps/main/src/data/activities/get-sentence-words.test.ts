import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { lessonSentenceFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { lessonWordFixture, wordFixture } from "@zoonk/testing/fixtures/words";
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

  test("returns LessonWord records matching words found in lesson sentences", async () => {
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
      }),
      wordFixture({
        organizationId: org.id,
        targetLanguage: "es",
        word: wordText1,
      }),
      wordFixture({
        organizationId: org.id,
        targetLanguage: "es",
        word: wordText2,
      }),
    ]);

    await Promise.all([
      lessonSentenceFixture({ lessonId: newLesson.id, sentenceId: sentence.id }),
      lessonWordFixture({ lessonId: newLesson.id, wordId: word1.id }),
      lessonWordFixture({ lessonId: newLesson.id, wordId: word2.id }),
    ]);

    const result = await getSentenceWords({ lessonId: newLesson.id });

    expect(result).toHaveLength(2);

    const words = result.map((item) => item.word.word);
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

  test("returns empty when sentence words have no matching LessonWord records", async () => {
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
    });

    await lessonSentenceFixture({ lessonId: newLesson.id, sentenceId: sentence.id });

    const result = await getSentenceWords({ lessonId: newLesson.id });
    expect(result).toEqual([]);
  });

  test("strips punctuation when matching sentence words to LessonWord records", async () => {
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
      }),
      wordFixture({
        organizationId: org.id,
        targetLanguage: "es",
        word: wordText,
      }),
    ]);

    await Promise.all([
      lessonSentenceFixture({ lessonId: newLesson.id, sentenceId: sentence.id }),
      lessonWordFixture({ lessonId: newLesson.id, wordId: word.id }),
    ]);

    const result = await getSentenceWords({ lessonId: newLesson.id });

    expect(result).toHaveLength(1);
    expect(result[0]?.word.word).toBe(word.word);
  });

  test("matches LessonWord records case-insensitively", async () => {
    const uniqueId = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "es",
      organizationId: org.id,
    });

    const wordText = `Hola${uniqueId}`;

    const [sentence, word] = await Promise.all([
      sentenceFixture({
        organizationId: org.id,
        sentence: `${wordText} mundo`,
        targetLanguage: "es",
      }),
      wordFixture({
        organizationId: org.id,
        targetLanguage: "es",
        word: wordText,
      }),
    ]);

    await Promise.all([
      lessonSentenceFixture({ lessonId: newLesson.id, sentenceId: sentence.id }),
      lessonWordFixture({
        lessonId: newLesson.id,
        translation: "hello",
        userLanguage: "en",
        wordId: word.id,
      }),
    ]);

    // extractUniqueSentenceWords lowercases to "hola...", but Word record has "Hola..."
    const result = await getSentenceWords({ lessonId: newLesson.id });

    const match = result.find((item) => item.word.word.toLowerCase() === wordText.toLowerCase());
    expect(match).toBeDefined();
    expect(match?.translation).toBe("hello");
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
      }),
      sentenceFixture({
        organizationId: org.id,
        sentence: `${wordText} grande`,
        targetLanguage: "es",
      }),
      wordFixture({
        organizationId: org.id,
        targetLanguage: "es",
        word: wordText,
      }),
    ]);

    await Promise.all([
      lessonSentenceFixture({ lessonId: newLesson.id, sentenceId: sentence1.id }),
      lessonSentenceFixture({ lessonId: newLesson.id, sentenceId: sentence2.id }),
      lessonWordFixture({ lessonId: newLesson.id, wordId: word.id }),
    ]);

    const result = await getSentenceWords({ lessonId: newLesson.id });

    const matchingWords = result.filter((item) => item.word.word === word.word);
    expect(matchingWords).toHaveLength(1);
  });
});
