import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, describe, expect, test } from "vitest";
import { saveReadingTargetWords } from "./save-reading-target-words";

/**
 * Reading target-word saves need a real lesson and language course so the
 * helper can prove it creates only learner-facing words, not distractor rows.
 */
async function createLanguageLesson({
  organizationId,
  targetLanguage = "de",
}: {
  organizationId: string;
  targetLanguage?: string;
}) {
  const course = await courseFixture({
    isPublished: true,
    organizationId,
    targetLanguage,
    title: `Reading Target Course ${randomUUID()}`,
  });
  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId,
    title: `Reading Target Chapter ${randomUUID()}`,
  });

  return lessonFixture({
    chapterId: chapter.id,
    generationStatus: "pending",
    isPublished: true,
    kind: "reading",
    organizationId,
    title: `Reading Target Lesson ${randomUUID()}`,
  });
}

describe(saveReadingTargetWords, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  test("creates lesson words only for canonical words with translations", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const translatedWord = `gato${id}`;
    const untranslatedWord = `bonito${id}`;
    const lesson = await createLanguageLesson({ organizationId });

    await saveReadingTargetWords({
      distractors: { [`${translatedWord} ${untranslatedWord}`]: [] },
      lessonId: lesson.id,
      organizationId,
      pronunciations: {},
      sentences: [
        {
          explanation: "test explanation",
          sentence: `${translatedWord} ${untranslatedWord}`,
          translation: "pretty cat",
        },
      ],
      targetLanguage: "de",
      userLanguage: "en",
      wordAudioUrls: {},
      wordMetadata: {
        [untranslatedWord]: { romanization: null, translation: "" },
        [translatedWord]: { romanization: null, translation: "cat" },
      },
    });

    const lessonWords = await prisma.lessonWord.findMany({
      include: { word: true },
      where: { lessonId: lesson.id },
    });

    expect(lessonWords.map((entry) => entry.word.word)).toEqual([translatedWord]);
  });

  test("reuses existing word casing instead of creating lowercase duplicates", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const existingWord = `Gato${id}`;
    const lowercaseWord = existingWord.toLowerCase();
    const [lesson] = await Promise.all([
      createLanguageLesson({ organizationId }),
      wordFixture({
        audioUrl: "/audio/gato.mp3",
        organizationId,
        targetLanguage: "de",
        word: existingWord,
      }),
    ]);

    await saveReadingTargetWords({
      distractors: { [lowercaseWord]: [] },
      lessonId: lesson.id,
      organizationId,
      pronunciations: { [lowercaseWord]: "ga-to" },
      sentences: [
        {
          explanation: "test explanation",
          sentence: lowercaseWord,
          translation: "cat",
        },
      ],
      targetLanguage: "de",
      userLanguage: "en",
      wordAudioUrls: {},
      wordMetadata: {
        [lowercaseWord]: { romanization: null, translation: "cat" },
      },
    });

    const [words, lessonWord] = await Promise.all([
      prisma.word.findMany({
        where: {
          organizationId,
          targetLanguage: "de",
          word: { in: [existingWord, lowercaseWord] },
        },
      }),
      prisma.lessonWord.findFirstOrThrow({
        include: { word: true },
        where: { lessonId: lesson.id },
      }),
    ]);

    expect(words).toHaveLength(1);
    expect(words[0]?.word).toBe(existingWord);
    expect(lessonWord.word.word).toBe(existingWord);
  });

  test("creates distractor word records without lesson-word rows", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const canonicalWord = `hallo${id}`;
    const distractorWord = `tschuss${id}`;
    const lesson = await createLanguageLesson({ organizationId });

    await saveReadingTargetWords({
      distractors: { [canonicalWord]: [distractorWord] },
      lessonId: lesson.id,
      organizationId,
      pronunciations: { [canonicalWord]: "ha-lo", [distractorWord]: "choos" },
      sentences: [
        {
          explanation: "test explanation",
          sentence: canonicalWord,
          translation: "hello",
        },
      ],
      targetLanguage: "de",
      userLanguage: "en",
      wordAudioUrls: {
        [canonicalWord]: `/audio/${canonicalWord}.mp3`,
        [distractorWord]: `/audio/${distractorWord}.mp3`,
      },
      wordMetadata: {
        [canonicalWord]: { romanization: null, translation: "hello" },
        [distractorWord]: { romanization: null, translation: "" },
      },
    });

    const [distractorRecord, distractorLessonWords] = await Promise.all([
      prisma.word.findFirstOrThrow({
        where: {
          organizationId,
          targetLanguage: "de",
          word: distractorWord,
        },
      }),
      prisma.lessonWord.findMany({
        where: {
          lessonId: lesson.id,
          word: { word: distractorWord },
        },
      }),
    ]);

    expect(distractorRecord.audioUrl).toBe(`/audio/${distractorWord}.mp3`);
    expect(distractorLessonWords).toEqual([]);
  });
});
