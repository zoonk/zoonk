import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { lessonSentenceFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import {
  lessonWordFixture,
  wordFixture,
  wordPronunciationFixture,
} from "@zoonk/testing/fixtures/words";
import { beforeAll, describe, expect, test } from "vitest";
import { getActivityDistractorWords } from "./get-activity-distractor-words";

describe(getActivityDistractorWords, () => {
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

  test("returns unique target-language distractor words with pronunciation for the lesson language", async () => {
    const id = crypto.randomUUID();
    const lessonForTest = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });
    const [canonicalWord, canonicalSentence, lessonWordDistractor, sharedDistractor] =
      await Promise.all([
        wordFixture({
          organizationId: org.id,
          targetLanguage: "de",
          word: `wort-${id}`,
        }),
        sentenceFixture({
          organizationId: org.id,
          sentence: `satz ${id}`,
          targetLanguage: "de",
        }),
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
      lessonWordFixture({
        distractors: [sharedDistractor.word.toLowerCase(), lessonWordDistractor.word],
        lessonId: lessonForTest.id,
        translation: `word-${id}`,
        userLanguage: "en",
        wordId: canonicalWord.id,
      }),
      lessonSentenceFixture({
        distractors: [sharedDistractor.word, `  ${sharedDistractor.word.toUpperCase()}  `],
        lessonId: lessonForTest.id,
        sentenceId: canonicalSentence.id,
        translation: `sentence-${id}`,
        translationDistractors: [`hello-${id}`],
        userLanguage: "en",
      }),
    ]);

    const result = await getActivityDistractorWords({ lessonId: lessonForTest.id });

    expect(result.map((item) => item.word).toSorted()).toEqual(
      [lessonWordDistractor.word, sharedDistractor.word].toSorted(),
    );
    expect(result).toEqual(
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

  test("ignores translation distractors and unresolved target-language texts", async () => {
    const id = crypto.randomUUID();
    const lessonForTest = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });
    const [canonicalWord, canonicalSentence, resolvedDistractor] = await Promise.all([
      wordFixture({
        organizationId: org.id,
        targetLanguage: "de",
        word: `wort-${id}`,
      }),
      sentenceFixture({
        organizationId: org.id,
        sentence: `satz ${id}`,
        targetLanguage: "de",
      }),
      wordFixture({
        organizationId: org.id,
        targetLanguage: "de",
        word: `Antwort-${id}`,
      }),
    ]);

    await Promise.all([
      lessonWordFixture({
        distractors: [resolvedDistractor.word, `missing-${id}`],
        lessonId: lessonForTest.id,
        translation: `word-${id}`,
        userLanguage: "en",
        wordId: canonicalWord.id,
      }),
      lessonSentenceFixture({
        distractors: [],
        lessonId: lessonForTest.id,
        sentenceId: canonicalSentence.id,
        translation: `sentence-${id}`,
        translationDistractors: [`user-language-only-${id}`],
        userLanguage: "en",
      }),
    ]);

    const result = await getActivityDistractorWords({ lessonId: lessonForTest.id });

    expect(result.map((item) => item.word)).toEqual([resolvedDistractor.word]);
  });

  test("returns empty array when the lesson has no stored language rows", async () => {
    const emptyLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    const result = await getActivityDistractorWords({ lessonId: emptyLesson.id });

    expect(result).toEqual([]);
  });
});
