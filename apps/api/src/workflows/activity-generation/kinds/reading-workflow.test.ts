import { randomUUID } from "node:crypto";
import { generateActivityRomanization } from "@zoonk/ai/tasks/activities/language/romanization";
import { generateActivitySentenceVariants } from "@zoonk/ai/tasks/activities/language/sentence-variants";
import { generateActivitySentences } from "@zoonk/ai/tasks/activities/language/sentences";
import { generateTranslation } from "@zoonk/ai/tasks/activities/language/translation";
import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { readingActivityWorkflow } from "./reading-workflow";

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

vi.mock("@zoonk/ai/tasks/activities/language/sentences", () => ({
  generateActivitySentences: vi.fn().mockResolvedValue({
    data: {
      sentences: [
        {
          explanation: "Basic sentence with verb 'ver' (to see) conjugated for 'yo'.",
          sentence: "Yo veo un gato.",
          translation: "I see a cat.",
        },
        {
          explanation: null,
          sentence: "Hola, como estas?",
          translation: "Hello, how are you?",
        },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/sentence-variants", () => ({
  generateActivitySentenceVariants: vi.fn().mockResolvedValue({
    data: {
      sentences: [
        { alternativeSentences: [], alternativeTranslations: [], id: "0" },
        { alternativeSentences: [], alternativeTranslations: [], id: "1" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/translation", () => ({
  generateTranslation: vi.fn().mockResolvedValue({
    data: { translation: "mocked" },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/romanization", () => ({
  generateActivityRomanization: vi.fn().mockResolvedValue({
    data: { romanizations: [] },
  }),
}));

vi.mock("@zoonk/core/audio/generate", () => ({
  generateLanguageAudio: vi.fn().mockResolvedValue({
    data: "https://example.com/audio.mp3",
    error: null,
  }),
}));

const words = [
  { alternativeTranslations: [], translation: "cat", word: "gato" },
  { alternativeTranslations: [], translation: "hello", word: "hola" },
];

function createSentenceGenerationResult(
  sentences: Awaited<ReturnType<typeof generateActivitySentences>>["data"]["sentences"],
): Awaited<ReturnType<typeof generateActivitySentences>> {
  return {
    data: { sentences },
    systemPrompt: "",
    usage: {} as Awaited<ReturnType<typeof generateActivitySentences>>["usage"],
    userPrompt: "",
  };
}

function createSentenceVariantResult(
  sentences: Awaited<ReturnType<typeof generateActivitySentenceVariants>>["data"]["sentences"],
): Awaited<ReturnType<typeof generateActivitySentenceVariants>> {
  return {
    data: { sentences },
    systemPrompt: "",
    usage: {} as Awaited<ReturnType<typeof generateActivitySentenceVariants>>["usage"],
    userPrompt: "",
  };
}

async function fetchLessonActivities(lessonId: number): Promise<LessonActivity[]> {
  const activities = await prisma.activity.findMany({
    include: {
      _count: { select: { steps: true } },
      lesson: {
        include: {
          chapter: {
            include: {
              course: { include: { organization: true } },
            },
          },
        },
      },
    },
    orderBy: { position: "asc" },
    where: { lessonId },
  });

  return activities.map((activity) => ({ ...activity, id: Number(activity.id) }));
}

describe(readingActivityWorkflow, () => {
  let organizationId: number;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId, targetLanguage: "es" });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Reading Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates reading sentences and steps in database", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Steps ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await readingActivityWorkflow(activities, "test-run-id", words, [], []);

    const sentences = await prisma.sentence.findMany({
      where: {
        organizationId,
        steps: { some: { activityId: activity.id } },
        targetLanguage: "es",
      },
    });

    expect(sentences).toHaveLength(2);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps).toHaveLength(2);

    for (const step of steps) {
      expect(step.kind).toBe("reading");
      expect(step.sentenceId).not.toBeNull();
      expect(step.isPublished).toBe(true);
    }
  });

  test("persists accepted sentence variants returned by AI audit", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const sentenceText = `Yo soy Lara ${id}.`;
    const translationText = `I am Lara ${id}.`;
    const alternativeSentence = `Soy Lara ${id}.`;
    const alternativeTranslation = `I'm Lara ${id}.`;

    vi.mocked(generateActivitySentences).mockResolvedValueOnce(
      createSentenceGenerationResult([
        {
          explanation: "Greeting variant",
          sentence: sentenceText,
          translation: translationText,
        },
      ]),
    );
    vi.mocked(generateActivitySentenceVariants).mockResolvedValueOnce(
      createSentenceVariantResult([
        {
          alternativeSentences: [alternativeSentence],
          alternativeTranslations: [alternativeTranslation],
          id: "0",
        },
      ]),
    );

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Variants ${randomUUID()}`,
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
    await readingActivityWorkflow(activities, "test-run-id", words, [], []);

    const savedSentence = await prisma.sentence.findFirst({
      include: { translations: true },
      where: {
        organizationId,
        sentence: sentenceText,
        targetLanguage: "es",
      },
    });

    expect(savedSentence).toMatchObject({
      alternativeSentences: [alternativeSentence],
      sentence: sentenceText,
    });

    const translation = savedSentence?.translations.find((t) => t.userLanguage === "en");
    expect(translation).toMatchObject({
      alternativeTranslations: [alternativeTranslation],
      translation: translationText,
    });
  });

  test("derives accepted sentence variants from lesson vocabulary when generation omits them", async () => {
    vi.mocked(generateActivitySentences).mockResolvedValueOnce(
      createSentenceGenerationResult([
        {
          explanation: null,
          sentence: "Guten Morgen, Anna!",
          translation: "Bom dia, Anna!",
        },
        {
          explanation: null,
          sentence: "Gute Nacht, Mama.",
          translation: "Boa noite, mãe.",
        },
      ]),
    );
    vi.mocked(generateActivitySentenceVariants).mockResolvedValueOnce(
      createSentenceVariantResult([
        { alternativeSentences: [], alternativeTranslations: [], id: "0" },
        { alternativeSentences: [], alternativeTranslations: [], id: "1" },
      ]),
    );

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Derived Variants ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "pt",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const greetingWords = [
      {
        alternativeTranslations: [],
        translation: "Bom dia",
        word: "Guten Morgen",
      },
      {
        alternativeTranslations: ["Bom dia"],
        translation: "Boa tarde",
        word: "Guten Tag",
      },
      {
        alternativeTranslations: [],
        translation: "Boa noite",
        word: "Guten Abend",
      },
      {
        alternativeTranslations: [],
        translation: "Boa noite",
        word: "Gute Nacht",
      },
      {
        alternativeTranslations: [],
        translation: "mãe",
        word: "Mama",
      },
    ];

    const activities = await fetchLessonActivities(lesson.id);
    await readingActivityWorkflow(activities, "test-run-id", greetingWords, [], []);

    const savedSentences = await prisma.sentence.findMany({
      include: { translations: true },
      orderBy: { sentence: "asc" },
      where: {
        organizationId,
        steps: { some: { activity: { lessonId: lesson.id } } },
        targetLanguage: "es",
      },
    });

    expect(savedSentences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          alternativeSentences: ["Guten Abend, Mama."],
          sentence: "Gute Nacht, Mama.",
          translations: expect.arrayContaining([
            expect.objectContaining({ translation: "Boa noite, mãe.", userLanguage: "pt" }),
          ]) as unknown,
        }),
        expect.objectContaining({
          alternativeSentences: ["Guten Tag, Anna!"],
          sentence: "Guten Morgen, Anna!",
          translations: expect.arrayContaining([
            expect.objectContaining({ translation: "Bom dia, Anna!", userLanguage: "pt" }),
          ]) as unknown,
        }),
      ]),
    );
  });

  test("falls back to vocabulary-derived variants when variant audit fails", async () => {
    vi.mocked(generateActivitySentences).mockResolvedValueOnce(
      createSentenceGenerationResult([
        {
          explanation: null,
          sentence: "Guten Morgen, Anna!",
          translation: "Bom dia, Anna!",
        },
      ]),
    );
    vi.mocked(generateActivitySentenceVariants).mockRejectedValueOnce(
      new Error("Sentence variants AI failed"),
    );

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Variant Fallback ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "pt",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const greetingWords = [
      {
        alternativeTranslations: [],
        translation: "Bom dia",
        word: "Guten Morgen",
      },
      {
        alternativeTranslations: ["Bom dia"],
        translation: "Boa tarde",
        word: "Guten Tag",
      },
    ];

    const activities = await fetchLessonActivities(lesson.id);
    await readingActivityWorkflow(activities, "test-run-id", greetingWords, [], []);

    const savedSentence = await prisma.sentence.findFirst({
      include: { translations: true },
      where: {
        organizationId,
        sentence: "Guten Morgen, Anna!",
        steps: { some: { activity: { lessonId: lesson.id } } },
        targetLanguage: "es",
      },
    });

    expect(savedSentence).toMatchObject({
      alternativeSentences: ["Guten Tag, Anna!"],
      sentence: "Guten Morgen, Anna!",
    });

    const translation = savedSentence?.translations.find((t) => t.userLanguage === "pt");
    expect(translation).toMatchObject({ translation: "Bom dia, Anna!" });
  });

  test("keeps AI sentence variants even when they introduce a different lesson phrase", async () => {
    vi.mocked(generateActivitySentences).mockResolvedValueOnce(
      createSentenceGenerationResult([
        {
          explanation: null,
          sentence: "Guten Tag, Herr Weber.",
          translation: "Boa tarde, senhor Weber.",
        },
      ]),
    );
    vi.mocked(generateActivitySentenceVariants).mockResolvedValueOnce(
      createSentenceVariantResult([
        {
          alternativeSentences: ["Guten Morgen, Herr Weber."],
          alternativeTranslations: [],
          id: "0",
        },
      ]),
    );

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Kept Variants ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "pt",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const greetingWords = [
      {
        alternativeTranslations: [],
        translation: "Bom dia",
        word: "Guten Morgen",
      },
      {
        alternativeTranslations: ["Bom dia"],
        translation: "Boa tarde",
        word: "Guten Tag",
      },
      {
        alternativeTranslations: [],
        translation: "senhor",
        word: "Herr",
      },
    ];

    const activities = await fetchLessonActivities(lesson.id);
    await readingActivityWorkflow(activities, "test-run-id", greetingWords, [], []);

    const savedSentence = await prisma.sentence.findFirst({
      include: { translations: true },
      where: {
        organizationId,
        sentence: "Guten Tag, Herr Weber.",
        steps: { some: { activity: { lessonId: lesson.id } } },
        targetLanguage: "es",
      },
    });

    expect(savedSentence).toMatchObject({
      alternativeSentences: ["Guten Morgen, Herr Weber."],
      sentence: "Guten Tag, Herr Weber.",
    });

    const translation = savedSentence?.translations.find((t) => t.userLanguage === "pt");
    expect(translation).toMatchObject({ translation: "Boa tarde, senhor Weber." });
  });

  test("sets reading status to 'completed' after full pipeline", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Complete ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await readingActivityWorkflow(activities, "test-run-id", words, [], []);

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("completed");
  });

  test("creates Word records for sentence words without creating LessonWord entries", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Words ${randomUUID()}`,
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
    await readingActivityWorkflow(activities, "test-run-id", words, [], []);

    // Sentence words should be saved as Word records
    const savedWords = await prisma.word.findMany({
      where: {
        organizationId,
        targetLanguage: "es",
        word: { in: ["yo", "veo", "un", "gato", "hola", "como", "estas"] },
      },
    });

    expect(savedWords).toHaveLength(7);

    // Sentence words should NOT be linked as LessonWord entries
    const lessonWords = await prisma.lessonWord.findMany({
      where: { lessonId: lesson.id },
    });

    expect(lessonWords).toHaveLength(0);
  });

  test("sets reading status to 'failed' when no source words available", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading NoWords ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await readingActivityWorkflow(activities, "test-run-id", [], [], []);

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
    expect(generateActivitySentences).not.toHaveBeenCalled();
    expect(generateActivitySentenceVariants).not.toHaveBeenCalled();
  });

  test("skips generation when activity is already completed", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading Skip ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "completed",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await readingActivityWorkflow(activities, "test-run-id", words, [], []);

    expect(generateActivitySentences).not.toHaveBeenCalled();
    expect(generateActivitySentenceVariants).not.toHaveBeenCalled();
  });

  test("does not save words with empty translation when metadata generation partially fails", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const failWord = `zfail${id}`;
    const passWord = `zpass${id}`;

    vi.mocked(generateActivitySentences).mockResolvedValueOnce(
      createSentenceGenerationResult([
        {
          explanation: null,
          sentence: `${passWord} ${failWord}`,
          translation: "pass fail",
        },
      ]),
    );

    vi.mocked(generateTranslation).mockImplementation(async ({ word }) => {
      if (word === failWord) {
        throw new Error("AI translation failure");
      }

      return {
        data: { translation: `translated-${word}` },
      } as Awaited<ReturnType<typeof generateTranslation>>;
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading PartialFail ${randomUUID()}`,
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
    await readingActivityWorkflow(activities, "test-run-id", words, [], []);

    const failWordInDb = await prisma.word.findMany({
      include: { translations: true },
      where: {
        organizationId,
        targetLanguage: "es",
        word: failWord,
      },
    });

    // Either no Word record at all, or no translation with empty string
    const emptyTranslationWords = failWordInDb.filter((word) =>
      word.translations.some((t) => t.translation === ""),
    );
    expect(emptyTranslationWords).toHaveLength(0);
  });

  test("reuses existing Word metadata with different casing (case-insensitive lookup)", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const capitalizedWord = `Zcap${id}`;
    const lowercaseWord = capitalizedWord.toLowerCase();

    const existingWord = await prisma.word.create({
      data: {
        organizationId,
        romanization: "existing-rom",
        targetLanguage: "es",
        word: capitalizedWord,
      },
    });

    await prisma.wordTranslation.create({
      data: {
        translation: "existing-translation",
        userLanguage: "en",
        wordId: existingWord.id,
      },
    });

    vi.mocked(generateActivitySentences).mockResolvedValueOnce(
      createSentenceGenerationResult([
        {
          explanation: null,
          sentence: `${capitalizedWord} test`,
          translation: "cap test",
        },
      ]),
    );

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading CaseInsensitive ${randomUUID()}`,
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
    await readingActivityWorkflow(activities, "test-run-id", words, [], []);

    // Should NOT call AI for the word since it already exists (just with different casing)
    expect(generateTranslation).not.toHaveBeenCalledWith(
      expect.objectContaining({ word: lowercaseWord }),
    );

    // Should not create a duplicate lowercase Word record
    const allVariants = await prisma.word.findMany({
      where: {
        organizationId,
        targetLanguage: "es",
        word: { in: [capitalizedWord, lowercaseWord] },
      },
    });

    expect(allVariants).toHaveLength(1);
    expect(allVariants[0]!.word).toBe(capitalizedWord);
  });

  test("does not call romanization for Roman-script languages", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const testWord = `zguten${id}`;

    vi.mocked(generateActivitySentences).mockResolvedValueOnce(
      createSentenceGenerationResult([
        {
          explanation: null,
          sentence: `${testWord} morgen`,
          translation: "good morning",
        },
      ]),
    );

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading RomanScript ${randomUUID()}`,
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
    await readingActivityWorkflow(activities, "test-run-id", words, [], []);

    expect(generateActivityRomanization).not.toHaveBeenCalled();

    const savedWord = await prisma.word.findFirst({
      where: {
        organizationId,
        targetLanguage: "es",
        word: testWord,
      },
    });

    expect(savedWord).not.toBeNull();
    expect(savedWord!.romanization).toBeNull();
  });

  test("generates romanization for non-Roman-script languages", async () => {
    const japaneseCourse = await courseFixture({ organizationId, targetLanguage: "ja" });
    const japaneseChapter = await chapterFixture({
      courseId: japaneseCourse.id,
      organizationId,
      title: `Japanese Chapter ${randomUUID()}`,
    });

    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const word1 = `猫${id}`;
    const word2 = `犬${id}`;

    vi.mocked(generateActivitySentences).mockResolvedValueOnce(
      createSentenceGenerationResult([
        {
          explanation: null,
          sentence: `${word1} ${word2}`,
          translation: "cat dog",
        },
      ]),
    );

    // First call: generateReadingRomanizationStep (for sentences)
    // Second call: generateSentenceWordMetadataStep (for individual words)
    vi.mocked(generateActivityRomanization)
      .mockResolvedValueOnce({
        data: { romanizations: [] },
      } as unknown as Awaited<ReturnType<typeof generateActivityRomanization>>)
      .mockResolvedValueOnce({
        data: { romanizations: ["neko", "inu"] },
      } as unknown as Awaited<ReturnType<typeof generateActivityRomanization>>);

    const lesson = await lessonFixture({
      chapterId: japaneseChapter.id,
      kind: "language",
      organizationId,
      title: `Reading NonRoman ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Reading ${randomUUID()}`,
    });

    const japaneseWords = [
      { alternativeTranslations: [], translation: "cat", word: word1 },
      { alternativeTranslations: [], translation: "dog", word: word2 },
    ];

    const activities = await fetchLessonActivities(lesson.id);
    await readingActivityWorkflow(activities, "test-run-id", japaneseWords, [], []);

    expect(generateActivityRomanization).toHaveBeenCalledWith(
      expect.objectContaining({
        targetLanguage: "ja",
        texts: expect.arrayContaining([word1, word2]) as string[],
      }),
    );

    const savedWords = await prisma.word.findMany({
      where: {
        organizationId,
        targetLanguage: "ja",
        word: { in: [word1, word2] },
      },
    });

    expect(savedWords).toHaveLength(2);

    for (const saved of savedWords) {
      expect(saved.romanization).not.toBeNull();
    }
  });

  test("skips TTS for sentence words that already have an audioUrl", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const existingWord = `zexist${id}`;
    const newWord = `znew${id}`;

    await prisma.word.create({
      data: {
        audioUrl: "https://example.com/existing-audio.mp3",
        organizationId,
        targetLanguage: "es",
        word: existingWord,
      },
    });

    vi.mocked(generateActivitySentences).mockResolvedValueOnce(
      createSentenceGenerationResult([
        {
          explanation: null,
          sentence: `${existingWord} ${newWord}`,
          translation: "existing new",
        },
      ]),
    );

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Reading SkipTTS ${randomUUID()}`,
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
    await readingActivityWorkflow(activities, "test-run-id", words, [], []);

    expect(generateLanguageAudio).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: existingWord }),
    );
    expect(generateLanguageAudio).toHaveBeenCalledWith(expect.objectContaining({ text: newWord }));
  });
});
