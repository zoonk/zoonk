import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { lessonWordFixture, wordFixture } from "@zoonk/testing/fixtures/words";
import { describe, expect, test } from "vitest";
import { saveReadingTargetWords } from "./save-reading-target-words";

/**
 * The helper persists lesson-scoped canonical words and reusable distractor words.
 * Each test gets its own lesson context so the assertions stay isolated and parallel-safe.
 */
async function createLessonContext() {
  const organization = await organizationFixture({ kind: "brand" });

  const course = await courseFixture({
    organizationId: organization.id,
    targetLanguage: "de",
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    organizationId: organization.id,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    kind: "language",
    organizationId: organization.id,
  });

  return { lesson, organization };
}

/**
 * Lesson words are the observable output for canonical sentence tokens, so most tests
 * assert against this joined query instead of lower-level individual rows.
 */
async function getLessonWordsWithWords(lessonId: number) {
  return prisma.lessonWord.findMany({
    include: { word: true },
    orderBy: { word: { word: "asc" } },
    where: { lessonId },
  });
}

describe(saveReadingTargetWords, () => {
  test("returns early when it cannot extract any canonical or distractor target words", async () => {
    const { lesson, organization } = await createLessonContext();

    const [wordCountBefore, lessonWordCountBefore, pronunciationCountBefore] = await Promise.all([
      prisma.word.count({ where: { organizationId: organization.id, targetLanguage: "de" } }),
      prisma.lessonWord.count({ where: { lessonId: lesson.id } }),
      prisma.wordPronunciation.count({ where: { userLanguage: "en" } }),
    ]);

    await saveReadingTargetWords({
      distractors: {},
      lessonId: lesson.id,
      organizationId: organization.id,
      pronunciations: {},
      sentences: [{ explanation: null, sentence: "... !!!", translation: "" }],
      targetLanguage: "de",
      userLanguage: "en",
      wordAudioUrls: {},
      wordMetadata: {},
    });

    const [wordCountAfter, lessonWordCountAfter, pronunciationCountAfter] = await Promise.all([
      prisma.word.count({ where: { organizationId: organization.id, targetLanguage: "de" } }),
      prisma.lessonWord.count({ where: { lessonId: lesson.id } }),
      prisma.wordPronunciation.count({ where: { userLanguage: "en" } }),
    ]);

    expect(wordCountAfter).toBe(wordCountBefore);
    expect(lessonWordCountAfter).toBe(lessonWordCountBefore);
    expect(pronunciationCountAfter).toBe(pronunciationCountBefore);
  });

  test("saves canonical sentence words and distractor words with metadata", async () => {
    const { lesson, organization } = await createLessonContext();
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const sentence = `Guten${id} Morgen${id} Lara${id}`;
    const canonicalWords = sentence.split(" ").map((word) => word.toLowerCase());
    const distractorWords = [`Abend${id}`, `Fenster${id}`] as const;

    await saveReadingTargetWords({
      distractors: {
        [sentence]: [...distractorWords],
      },
      lessonId: lesson.id,
      organizationId: organization.id,
      pronunciations: {
        [canonicalWords[0]!]: `${canonicalWords[0]}-pron`,
        [canonicalWords[1]!]: `${canonicalWords[1]}-pron`,
        [canonicalWords[2]!]: `${canonicalWords[2]}-pron`,
        [distractorWords[0]]: `${distractorWords[0]}-pron`,
      },
      sentences: [{ explanation: "Greeting", sentence, translation: `good morning ${id}` }],
      targetLanguage: "de",
      userLanguage: "en",
      wordAudioUrls: {
        [canonicalWords[0]!]: `/audio/${canonicalWords[0]}.mp3`,
        [canonicalWords[1]!]: `/audio/${canonicalWords[1]}.mp3`,
        [canonicalWords[2]!]: `/audio/${canonicalWords[2]}.mp3`,
        [distractorWords[0]]: `/audio/${distractorWords[0]}.mp3`,
        [distractorWords[1]]: `/audio/${distractorWords[1]}.mp3`,
      },
      wordMetadata: {
        [canonicalWords[0]!]: {
          romanization: `${canonicalWords[0]}-rom`,
          translation: `good-${id}`,
        },
        [canonicalWords[1]!]: {
          romanization: `${canonicalWords[1]}-rom`,
          translation: `morning-${id}`,
        },
        [canonicalWords[2]!]: {
          romanization: `${canonicalWords[2]}-rom`,
          translation: `lara-${id}`,
        },
        [distractorWords[0]]: { romanization: `${distractorWords[0]}-rom`, translation: "" },
        [distractorWords[1]]: { romanization: null, translation: "" },
      },
    });

    const [lessonWords, words, pronunciations] = await Promise.all([
      getLessonWordsWithWords(lesson.id),
      prisma.word.findMany({
        orderBy: { word: "asc" },
        where: {
          organizationId: organization.id,
          targetLanguage: "de",
          word: { in: [...canonicalWords, ...distractorWords] },
        },
      }),
      prisma.wordPronunciation.findMany({
        include: { word: true },
        orderBy: { word: { word: "asc" } },
        where: {
          userLanguage: "en",
          word: {
            organizationId: organization.id,
            targetLanguage: "de",
            word: { in: [...canonicalWords, ...distractorWords] },
          },
        },
      }),
    ]);

    expect(lessonWords.map((entry) => [entry.word.word, entry.translation])).toEqual([
      [canonicalWords[0]!, `good-${id}`],
      [canonicalWords[2]!, `lara-${id}`],
      [canonicalWords[1]!, `morning-${id}`],
    ]);

    expect(words.map((entry) => [entry.word, entry.audioUrl, entry.romanization])).toEqual([
      [distractorWords[0], `/audio/${distractorWords[0]}.mp3`, `${distractorWords[0]}-rom`],
      [distractorWords[1], `/audio/${distractorWords[1]}.mp3`, null],
      [canonicalWords[0]!, `/audio/${canonicalWords[0]}.mp3`, `${canonicalWords[0]}-rom`],
      [canonicalWords[2]!, `/audio/${canonicalWords[2]}.mp3`, `${canonicalWords[2]}-rom`],
      [canonicalWords[1]!, `/audio/${canonicalWords[1]}.mp3`, `${canonicalWords[1]}-rom`],
    ]);

    expect(pronunciations.map((entry) => [entry.word.word, entry.pronunciation])).toEqual([
      [distractorWords[0], `${distractorWords[0]}-pron`],
      [canonicalWords[0]!, `${canonicalWords[0]}-pron`],
      [canonicalWords[2]!, `${canonicalWords[2]}-pron`],
      [canonicalWords[1]!, `${canonicalWords[1]}-pron`],
    ]);
  });

  test("skips canonical sentence tokens that do not have translations", async () => {
    const { lesson, organization } = await createLessonContext();
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const translatedWord = `gato${id}`;
    const untranslatedWord = `bonito${id}`;

    await saveReadingTargetWords({
      distractors: {},
      lessonId: lesson.id,
      organizationId: organization.id,
      pronunciations: {},
      sentences: [
        {
          explanation: null,
          sentence: `${translatedWord} ${untranslatedWord}`,
          translation: "pretty cat",
        },
      ],
      targetLanguage: "de",
      userLanguage: "en",
      wordAudioUrls: {},
      wordMetadata: {
        [translatedWord]: { romanization: null, translation: "cat" },
        [untranslatedWord]: { romanization: null, translation: "" },
      },
    });

    const lessonWords = await getLessonWordsWithWords(lesson.id);

    expect(lessonWords.map((entry) => entry.word.word)).toEqual([translatedWord]);
  });

  test("deduplicates distractors and skips overlaps with canonical words", async () => {
    const { lesson, organization } = await createLessonContext();
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const canonicalWord = `gato${id}`;
    const distractorWord = `Perro${id}`;

    await saveReadingTargetWords({
      distractors: {
        [canonicalWord]: [canonicalWord.toUpperCase(), distractorWord, `  ${distractorWord}  `],
      },
      lessonId: lesson.id,
      organizationId: organization.id,
      pronunciations: {
        [canonicalWord]: `${canonicalWord}-pron`,
      },
      sentences: [{ explanation: null, sentence: canonicalWord, translation: "cat" }],
      targetLanguage: "de",
      userLanguage: "en",
      wordAudioUrls: {
        [canonicalWord]: `/audio/${canonicalWord}.mp3`,
      },
      wordMetadata: {
        [canonicalWord]: { romanization: `${canonicalWord}-rom`, translation: "cat" },
        [distractorWord]: { romanization: null, translation: "" },
      },
    });

    const [lessonWords, distractorLessonWords, words, pronunciations] = await Promise.all([
      getLessonWordsWithWords(lesson.id),
      prisma.lessonWord.findMany({
        where: {
          lessonId: lesson.id,
          word: { word: { in: [distractorWord] } },
        },
      }),
      prisma.word.findMany({
        orderBy: { word: "asc" },
        where: {
          organizationId: organization.id,
          targetLanguage: "de",
          word: { in: [canonicalWord, distractorWord] },
        },
      }),
      prisma.wordPronunciation.findMany({
        include: { word: true },
        orderBy: { word: { word: "asc" } },
        where: {
          userLanguage: "en",
          word: {
            organizationId: organization.id,
            targetLanguage: "de",
            word: { in: [canonicalWord, distractorWord] },
          },
        },
      }),
    ]);

    expect(lessonWords.map((entry) => entry.word.word)).toEqual([canonicalWord]);
    expect(distractorLessonWords).toEqual([]);

    expect(words.map((entry) => [entry.word, entry.audioUrl])).toEqual([
      [canonicalWord, `/audio/${canonicalWord}.mp3`],
      [distractorWord, null],
    ]);

    expect(pronunciations.map((entry) => entry.word.word)).toEqual([canonicalWord]);
  });

  test("stores null romanization and no pronunciation when metadata omits them", async () => {
    const { lesson, organization } = await createLessonContext();
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const canonicalWord = `hallo${id}`;
    const distractorWord = `tschuss${id}`;

    await saveReadingTargetWords({
      distractors: {
        [canonicalWord]: [distractorWord],
      },
      lessonId: lesson.id,
      organizationId: organization.id,
      pronunciations: {},
      sentences: [{ explanation: null, sentence: canonicalWord, translation: "hello" }],
      targetLanguage: "de",
      userLanguage: "en",
      wordAudioUrls: {},
      wordMetadata: {
        [canonicalWord]: { romanization: "", translation: "hello" },
        [distractorWord]: { romanization: "", translation: "" },
      },
    });

    const [lessonWords, words, pronunciations] = await Promise.all([
      getLessonWordsWithWords(lesson.id),
      prisma.word.findMany({
        orderBy: { word: "asc" },
        where: {
          organizationId: organization.id,
          targetLanguage: "de",
          word: { in: [canonicalWord, distractorWord] },
        },
      }),
      prisma.wordPronunciation.findMany({
        include: { word: true },
        where: {
          userLanguage: "en",
          word: {
            organizationId: organization.id,
            targetLanguage: "de",
            word: { in: [canonicalWord, distractorWord] },
          },
        },
      }),
    ]);

    expect(lessonWords).toHaveLength(1);
    expect(lessonWords[0]).toMatchObject({ distractors: [], translation: "hello" });

    expect(words.map((entry) => [entry.word, entry.audioUrl, entry.romanization])).toEqual([
      [canonicalWord, null, null],
      [distractorWord, null, null],
    ]);

    expect(pronunciations).toEqual([]);
  });

  test("reuses existing casing and preserves existing lesson distractors on canonical updates", async () => {
    const { lesson, organization } = await createLessonContext();
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const existingWord = `Gato${id}`;
    const lowercaseWord = existingWord.toLowerCase();

    const word = await wordFixture({
      audioUrl: "/audio/existing.mp3",
      organizationId: organization.id,
      romanization: `${lowercaseWord}-rom`,
      targetLanguage: "de",
      word: existingWord,
    });

    await lessonWordFixture({
      distractors: [`keep-${id}`],
      lessonId: lesson.id,
      translation: "old translation",
      userLanguage: "en",
      wordId: word.id,
    });

    await saveReadingTargetWords({
      distractors: {},
      lessonId: lesson.id,
      organizationId: organization.id,
      pronunciations: {
        [lowercaseWord]: `${lowercaseWord}-pron`,
      },
      sentences: [{ explanation: null, sentence: lowercaseWord, translation: "cat" }],
      targetLanguage: "de",
      userLanguage: "en",
      wordAudioUrls: {},
      wordMetadata: {
        [lowercaseWord]: { romanization: `${lowercaseWord}-rom`, translation: "cat" },
      },
    });

    const [words, lessonWords, pronunciations] = await Promise.all([
      prisma.word.findMany({
        where: {
          organizationId: organization.id,
          targetLanguage: "de",
          word: { in: [existingWord, lowercaseWord] },
        },
      }),
      getLessonWordsWithWords(lesson.id),
      prisma.wordPronunciation.findMany({
        where: { userLanguage: "en", wordId: word.id },
      }),
    ]);

    expect(words).toHaveLength(1);
    expect(words[0]).toMatchObject({ audioUrl: "/audio/existing.mp3", word: existingWord });
    expect(lessonWords[0]).toMatchObject({ distractors: [`keep-${id}`], translation: "cat" });
    expect(lessonWords[0]?.word.word).toBe(existingWord);
    expect(pronunciations).toHaveLength(1);
    expect(pronunciations[0]?.pronunciation).toBe(`${lowercaseWord}-pron`);
  });

  test("reuses existing casing for distractors and keeps them out of lesson vocabulary", async () => {
    const { lesson, organization } = await createLessonContext();
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const canonicalWord = `hallo${id}`;
    const existingDistractor = `Fenster${id}`;
    const lowercaseDistractor = existingDistractor.toLowerCase();

    const distractorWord = await wordFixture({
      audioUrl: "/audio/existing-distractor.mp3",
      organizationId: organization.id,
      romanization: "old-rom",
      targetLanguage: "de",
      word: existingDistractor,
    });

    await saveReadingTargetWords({
      distractors: {
        [canonicalWord]: [lowercaseDistractor],
      },
      lessonId: lesson.id,
      organizationId: organization.id,
      pronunciations: {
        [lowercaseDistractor]: `${lowercaseDistractor}-pron`,
      },
      sentences: [{ explanation: null, sentence: canonicalWord, translation: "hello" }],
      targetLanguage: "de",
      userLanguage: "en",
      wordAudioUrls: {},
      wordMetadata: {
        [canonicalWord]: { romanization: null, translation: "hello" },
        [lowercaseDistractor]: {
          romanization: `${lowercaseDistractor}-rom`,
          translation: "",
        },
      },
    });

    const [lessonWords, words, pronunciations] = await Promise.all([
      getLessonWordsWithWords(lesson.id),
      prisma.word.findMany({
        where: {
          organizationId: organization.id,
          targetLanguage: "de",
          word: { in: [canonicalWord, existingDistractor, lowercaseDistractor] },
        },
      }),
      prisma.wordPronunciation.findMany({
        include: { word: true },
        where: {
          userLanguage: "en",
          wordId: distractorWord.id,
        },
      }),
    ]);

    expect(lessonWords.map((entry) => entry.word.word)).toEqual([canonicalWord]);
    expect(words).toHaveLength(2);

    expect(words.find((entry) => entry.id === distractorWord.id)).toMatchObject({
      audioUrl: "/audio/existing-distractor.mp3",
      romanization: `${lowercaseDistractor}-rom`,
      word: existingDistractor,
    });

    expect(pronunciations).toHaveLength(1);
    expect(pronunciations[0]).toMatchObject({ pronunciation: `${lowercaseDistractor}-pron` });
    expect(pronunciations[0]?.word.word).toBe(existingDistractor);
  });
});
