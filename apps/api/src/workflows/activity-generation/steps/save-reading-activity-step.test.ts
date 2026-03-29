import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/_test-utils/fetch-lesson-activities";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { saveReadingActivityStep } from "./save-reading-activity-step";

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: vi.fn().mockResolvedValue(null),
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

describe(saveReadingActivityStep, () => {
  let organizationId: number;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    course = await courseFixture({ organizationId, targetLanguage: "de" });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Save Reading Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("saves sentences, canonical lesson words, and distractor word metadata", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const canonicalWords = [`Guten${id}`, `Morgen${id}`, `Lara${id}`] as const;
    const generatedDistractorWords = [`Abend${id}`, `Fenster${id}`] as const;
    const sentence = canonicalWords.join(" ");
    const translation = `Good morning ${id}`;
    const translationDistractors = [`hello-${id}`, `bye-${id}`];
    const normalizedCanonicalWords = canonicalWords.map((word) => word.toLowerCase());

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Save Reading ${randomUUID()}`,
    });

    const readingActivity = await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    await saveReadingActivityStep({
      activities,
      distractors: {
        [sentence]: [...generatedDistractorWords, sentence],
      },
      pronunciations: {
        [generatedDistractorWords[0]]: generatedDistractorWords[0].toLowerCase(),
        [generatedDistractorWords[1]]: generatedDistractorWords[1].toLowerCase(),
        [normalizedCanonicalWords[0]!]: normalizedCanonicalWords[0]!,
        [normalizedCanonicalWords[1]!]: normalizedCanonicalWords[1]!,
        [normalizedCanonicalWords[2]!]: normalizedCanonicalWords[2]!,
      },
      sentenceAudioUrls: {
        [sentence]: "/audio/sentence.mp3",
      },
      sentenceRomanizations: {
        [sentence]: normalizedCanonicalWords.join(" "),
      },
      sentences: [
        {
          explanation: "Greeting",
          sentence,
          translation,
        },
      ],
      translationDistractors: {
        [translation]: translationDistractors,
      },
      wordAudioUrls: {
        [generatedDistractorWords[0]]: `/audio/${generatedDistractorWords[0]}.mp3`,
        [generatedDistractorWords[1]]: `/audio/${generatedDistractorWords[1]}.mp3`,
        [normalizedCanonicalWords[0]!]: `/audio/${normalizedCanonicalWords[0]}.mp3`,
        [normalizedCanonicalWords[1]!]: `/audio/${normalizedCanonicalWords[1]}.mp3`,
        [normalizedCanonicalWords[2]!]: `/audio/${normalizedCanonicalWords[2]}.mp3`,
      },
      wordMetadata: {
        [generatedDistractorWords[0]]: { romanization: null, translation: "" },
        [generatedDistractorWords[1]]: { romanization: null, translation: "" },
        [normalizedCanonicalWords[0]!]: { romanization: null, translation: `good-${id}` },
        [normalizedCanonicalWords[1]!]: { romanization: null, translation: `morning-${id}` },
        [normalizedCanonicalWords[2]!]: { romanization: null, translation: canonicalWords[2] },
      },
      workflowRunId: "workflow-1",
    });

    const savedSentence = await prisma.sentence.findFirstOrThrow({
      where: {
        organizationId,
        sentence,
        targetLanguage: "de",
      },
    });
    const [
      lessonSentence,
      lessonWords,
      savedDistractorWords,
      distractorLessonWords,
      step,
      pronunciations,
      dbActivity,
    ] = await Promise.all([
      prisma.lessonSentence.findUniqueOrThrow({
        where: {
          lessonSentence: {
            lessonId: lesson.id,
            sentenceId: savedSentence.id,
          },
        },
      }),
      prisma.lessonWord.findMany({
        include: { word: true },
        orderBy: { word: { word: "asc" } },
        where: { lessonId: lesson.id },
      }),
      prisma.word.findMany({
        orderBy: { word: "asc" },
        where: {
          organizationId,
          targetLanguage: "de",
          word: { in: [...generatedDistractorWords] },
        },
      }),
      prisma.lessonWord.findMany({
        where: {
          lessonId: lesson.id,
          word: {
            word: { in: [...generatedDistractorWords] },
          },
        },
      }),
      prisma.step.findFirstOrThrow({
        where: { activityId: readingActivity.id, kind: "reading", position: 0 },
      }),
      prisma.wordPronunciation.findMany({
        orderBy: { wordId: "asc" },
        where: {
          userLanguage: "en",
          word: {
            organizationId,
            targetLanguage: "de",
            word: { in: [...generatedDistractorWords, ...normalizedCanonicalWords] },
          },
        },
      }),
      prisma.activity.findUniqueOrThrow({
        where: { id: readingActivity.id },
      }),
    ]);

    expect(savedSentence).toMatchObject({
      audioUrl: "/audio/sentence.mp3",
      romanization: normalizedCanonicalWords.join(" "),
      sentence,
    });
    expect(lessonSentence).toMatchObject({
      distractors: [...generatedDistractorWords],
      explanation: "Greeting",
      translation,
      translationDistractors,
    });
    expect(step.sentenceId).toBe(savedSentence.id);
    expect(lessonWords.map((entry) => [entry.word.word, entry.translation])).toEqual([
      [normalizedCanonicalWords[0]!, `good-${id}`],
      [normalizedCanonicalWords[2]!, canonicalWords[2]],
      [normalizedCanonicalWords[1]!, `morning-${id}`],
    ]);
    expect(savedDistractorWords.map((entry) => entry.word)).toEqual([...generatedDistractorWords]);
    expect(distractorLessonWords).toEqual([]);
    expect(pronunciations).toHaveLength(5);
    expect(dbActivity).toMatchObject({
      generationRunId: "workflow-1",
      generationStatus: "completed",
    });
  });

  test("does not create lesson words for canonical tokens missing translations", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const translatedWord = `gato${id}`;
    const untranslatedWord = `bonito${id}`;

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Save Reading Partial ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    await saveReadingActivityStep({
      activities,
      distractors: { [`${translatedWord} ${untranslatedWord}`]: [] },
      pronunciations: {},
      sentenceAudioUrls: {},
      sentenceRomanizations: {},
      sentences: [
        {
          explanation: null,
          sentence: `${translatedWord} ${untranslatedWord}`,
          translation: "pretty cat",
        },
      ],
      translationDistractors: { "pretty cat": [] },
      wordAudioUrls: {},
      wordMetadata: {
        [untranslatedWord]: { romanization: null, translation: "" },
        [translatedWord]: { romanization: null, translation: "cat" },
      },
      workflowRunId: "workflow-2",
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

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Save Reading Casing ${randomUUID()}`,
    });

    await Promise.all([
      activityFixture({
        generationStatus: "pending",
        kind: "reading",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        title: `Reading ${randomUUID()}`,
      }),
      wordFixture({
        audioUrl: "/audio/gato.mp3",
        organizationId,
        targetLanguage: "de",
        word: existingWord,
      }),
    ]);

    const activities = await fetchLessonActivities(lesson.id);

    await saveReadingActivityStep({
      activities,
      distractors: { [lowercaseWord]: [] },
      pronunciations: { [lowercaseWord]: "ga-to" },
      sentenceAudioUrls: {},
      sentenceRomanizations: {},
      sentences: [
        {
          explanation: null,
          sentence: lowercaseWord,
          translation: "cat",
        },
      ],
      translationDistractors: { cat: [] },
      wordAudioUrls: {},
      wordMetadata: {
        [lowercaseWord]: { romanization: null, translation: "cat" },
      },
      workflowRunId: "workflow-3",
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
});
