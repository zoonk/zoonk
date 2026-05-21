import { randomUUID } from "node:crypto";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { chapterSentenceFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { chapterWordFixture, wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, describe, expect, it } from "vitest";
import { getChapterSentenceWordsForIds } from "./get-chapter-sentence-words";

describe(getChapterSentenceWordsForIds, () => {
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

  it("returns ChapterWord records matching words found in lesson sentences", async () => {
    const uniqueId = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
    const wordText1 = `hola${uniqueId}`;
    const wordText2 = `mundo${uniqueId}`;

    const [newLesson, sentence, word1, word2] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        language: "es",
        organizationId: org.id,
      }),
      sentenceFixture({
        organizationId: org.id,
        sentence: `${wordText1} ${wordText2}`,
        targetLanguage: "es",
      }),
      wordFixture({ organizationId: org.id, targetLanguage: "es", word: wordText1 }),
      wordFixture({ organizationId: org.id, targetLanguage: "es", word: wordText2 }),
    ]);

    const [chapterSentence] = await Promise.all([
      chapterSentenceFixture({ sentenceId: sentence.id, sourceLessonId: newLesson.id }),
      chapterWordFixture({ sourceLessonId: newLesson.id, wordId: word1.id }),
      chapterWordFixture({ sourceLessonId: newLesson.id, wordId: word2.id }),
    ]);

    const result = await getChapterSentenceWordsForIds({
      chapterSentenceIds: [chapterSentence.id],
    });

    expect(result).toHaveLength(2);

    const words = result.map((item) => item.word.word);
    expect(words).toContain(word1.word);
    expect(words).toContain(word2.word);
  });

  it("returns empty array when no ids are requested", async () => {
    const result = await getChapterSentenceWordsForIds({ chapterSentenceIds: [] });
    expect(result).toStrictEqual([]);
  });

  it("returns empty array for non-existent chapter sentence", async () => {
    const result = await getChapterSentenceWordsForIds({ chapterSentenceIds: [randomUUID()] });
    expect(result).toStrictEqual([]);
  });

  it("returns empty when sentence words have no matching ChapterWord records", async () => {
    const uniqueId = crypto.randomUUID().replaceAll("-", "").slice(0, 8);

    const [newLesson, sentence] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        language: "es",
        organizationId: org.id,
      }),
      sentenceFixture({
        organizationId: org.id,
        sentence: `noexiste${uniqueId} tampoco${uniqueId}`,
        targetLanguage: "es",
      }),
    ]);

    const chapterSentence = await chapterSentenceFixture({
      sentenceId: sentence.id,
      sourceLessonId: newLesson.id,
    });

    const result = await getChapterSentenceWordsForIds({
      chapterSentenceIds: [chapterSentence.id],
    });

    expect(result).toStrictEqual([]);
  });

  it("strips punctuation when matching sentence words to ChapterWord records", async () => {
    const uniqueId = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
    const wordText = `sabes${uniqueId}`;

    const [newLesson, sentence, word] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        language: "es",
        organizationId: org.id,
      }),
      sentenceFixture({ organizationId: org.id, sentence: `${wordText}?`, targetLanguage: "es" }),
      wordFixture({ organizationId: org.id, targetLanguage: "es", word: wordText }),
    ]);

    const [chapterSentence] = await Promise.all([
      chapterSentenceFixture({ sentenceId: sentence.id, sourceLessonId: newLesson.id }),
      chapterWordFixture({ sourceLessonId: newLesson.id, wordId: word.id }),
    ]);

    const result = await getChapterSentenceWordsForIds({
      chapterSentenceIds: [chapterSentence.id],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.word.word).toBe(word.word);
  });

  it("matches ChapterWord records case-insensitively", async () => {
    const uniqueId = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
    const wordText = `Hola${uniqueId}`;

    const [newLesson, sentence, word] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        language: "es",
        organizationId: org.id,
      }),
      sentenceFixture({
        organizationId: org.id,
        sentence: `${wordText} mundo`,
        targetLanguage: "es",
      }),
      wordFixture({ organizationId: org.id, targetLanguage: "es", word: wordText }),
    ]);

    const [chapterSentence] = await Promise.all([
      chapterSentenceFixture({ sentenceId: sentence.id, sourceLessonId: newLesson.id }),
      chapterWordFixture({
        sourceLessonId: newLesson.id,
        translation: "hello",
        userLanguage: "en",
        wordId: word.id,
      }),
    ]);

    // extractUniqueSentenceWords lowercases to "hola...", but Word record has "Hola..."
    const result = await getChapterSentenceWordsForIds({
      chapterSentenceIds: [chapterSentence.id],
    });

    const match = result.find((item) => item.word.word.toLowerCase() === wordText.toLowerCase());
    expect(match).toBeDefined();
    expect(match?.translation).toBe("hello");
  });

  it("deduplicates words across multiple sentences", async () => {
    const uniqueId = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
    const wordText = `gato${uniqueId}`;

    const [newLesson, sentence1, sentence2, word] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        language: "es",
        organizationId: org.id,
      }),
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
      wordFixture({ organizationId: org.id, targetLanguage: "es", word: wordText }),
    ]);

    const [chapterSentence1, chapterSentence2] = await Promise.all([
      chapterSentenceFixture({ sentenceId: sentence1.id, sourceLessonId: newLesson.id }),
      chapterSentenceFixture({ sentenceId: sentence2.id, sourceLessonId: newLesson.id }),
      chapterWordFixture({ sourceLessonId: newLesson.id, wordId: word.id }),
    ]);

    const result = await getChapterSentenceWordsForIds({
      chapterSentenceIds: [chapterSentence1.id, chapterSentence2.id],
    });

    const matchingWords = result.filter((item) => item.word.word === word.word);
    expect(matchingWords).toHaveLength(1);
  });
});
