import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { chapterSentenceFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import {
  chapterWordFixture,
  wordFixture,
  wordPronunciationFixture,
} from "@zoonk/testing/fixtures/words";
import { beforeAll, describe, expect, it } from "vitest";
import { getChapterDistractorWords } from "./get-chapter-distractor-words";

describe(getChapterDistractorWords, () => {
  let org: Awaited<ReturnType<typeof organizationFixture>>;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    org = await organizationFixture({ kind: "brand" });

    course = await courseFixture({
      isPublished: true,
      language: "en",
      organizationId: org.id,
      targetLanguage: "de",
    });

    chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });
  });

  it("returns unique target-language distractor words with pronunciation for the lesson language", async () => {
    const id = crypto.randomUUID();

    const [
      lessonForTest,
      canonicalWord,
      canonicalSentence,
      lessonWordDistractor,
      sharedDistractor,
    ] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        language: "en",
        organizationId: org.id,
      }),
      wordFixture({ organizationId: org.id, targetLanguage: "de", word: `wort-${id}` }),
      sentenceFixture({ organizationId: org.id, sentence: `satz ${id}`, targetLanguage: "de" }),
      wordFixture({
        audioUrl: `https://example.com/fenster-${id}.mp3`,
        organizationId: org.id,
        romanization: `fenster-${id}-rom`,
        targetLanguage: "de",
        word: `Fenster-${id}`,
      }),
      wordFixture({
        audioUrl: `https://example.com/abend-${id}.mp3`,
        organizationId: org.id,
        romanization: `abend-${id}-rom`,
        targetLanguage: "de",
        word: `Abend-${id}`,
      }),
    ]);

    await Promise.all([
      wordPronunciationFixture({
        pronunciation: `AB-end-${id}`,
        userLanguage: "en",
        wordId: sharedDistractor.id,
      }),
      wordPronunciationFixture({
        pronunciation: `a-BEN-de-${id}`,
        userLanguage: "pt",
        wordId: sharedDistractor.id,
      }),
      wordPronunciationFixture({
        pronunciation: `FEN-ster-${id}`,
        userLanguage: "en",
        wordId: lessonWordDistractor.id,
      }),
    ]);

    const [chapterWord, chapterSentence] = await Promise.all([
      chapterWordFixture({
        distractors: [sharedDistractor.word.toLowerCase(), lessonWordDistractor.word],
        sourceLessonId: lessonForTest.id,
        translation: `word-${id}`,
        userLanguage: "en",
        wordId: canonicalWord.id,
      }),
      chapterSentenceFixture({
        distractors: [sharedDistractor.word, `  ${sharedDistractor.word.toUpperCase()}  `],
        sentenceId: canonicalSentence.id,
        sourceLessonId: lessonForTest.id,
        translation: `sentence-${id}`,
        translationDistractors: [`hello-${id}`],
        userLanguage: "en",
      }),
    ]);

    const result = await getChapterDistractorWords({
      chapterSentenceIds: [chapterSentence.id],
      chapterWordIds: [chapterWord.id],
    });

    expect(result.map((item) => item.word).toSorted()).toStrictEqual(
      [lessonWordDistractor.word, sharedDistractor.word].toSorted(),
    );

    expect(result).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          audioUrl: lessonWordDistractor.audioUrl,
          pronunciations: [
            expect.objectContaining({ pronunciation: `FEN-ster-${id}`, userLanguage: "en" }),
          ],
          romanization: lessonWordDistractor.romanization,
          word: lessonWordDistractor.word,
        }),
        expect.objectContaining({
          audioUrl: sharedDistractor.audioUrl,
          pronunciations: [
            expect.objectContaining({ pronunciation: `AB-end-${id}`, userLanguage: "en" }),
          ],
          romanization: sharedDistractor.romanization,
          word: sharedDistractor.word,
        }),
      ]) as unknown,
    );
  });

  it("ignores translation distractors and unresolved target-language texts", async () => {
    const id = crypto.randomUUID();

    const [lessonForTest, canonicalWord, canonicalSentence, resolvedDistractor] = await Promise.all(
      [
        lessonFixture({
          chapterId: chapter.id,
          isPublished: true,
          language: "en",
          organizationId: org.id,
        }),
        wordFixture({ organizationId: org.id, targetLanguage: "de", word: `wort-${id}` }),
        sentenceFixture({ organizationId: org.id, sentence: `satz ${id}`, targetLanguage: "de" }),
        wordFixture({ organizationId: org.id, targetLanguage: "de", word: `Antwort-${id}` }),
      ],
    );

    const [chapterWord, chapterSentence] = await Promise.all([
      chapterWordFixture({
        distractors: [resolvedDistractor.word, `missing-${id}`],
        sourceLessonId: lessonForTest.id,
        translation: `word-${id}`,
        userLanguage: "en",
        wordId: canonicalWord.id,
      }),
      chapterSentenceFixture({
        distractors: [],
        sentenceId: canonicalSentence.id,
        sourceLessonId: lessonForTest.id,
        translation: `sentence-${id}`,
        translationDistractors: [`user-language-only-${id}`],
        userLanguage: "en",
      }),
    ]);

    const result = await getChapterDistractorWords({
      chapterSentenceIds: [chapterSentence.id],
      chapterWordIds: [chapterWord.id],
    });

    expect(result.map((item) => item.word)).toStrictEqual([resolvedDistractor.word]);
  });

  it("returns empty array when the lesson has no stored language rows", async () => {
    const result = await getChapterDistractorWords({ chapterSentenceIds: [], chapterWordIds: [] });

    expect(result).toStrictEqual([]);
  });
});
