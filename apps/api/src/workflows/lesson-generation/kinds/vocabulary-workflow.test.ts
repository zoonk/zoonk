import { randomUUID } from "node:crypto";
import { generateLessonDistractors } from "@zoonk/ai/tasks/lessons/language/distractors";
import { generateLessonPronunciation } from "@zoonk/ai/tasks/lessons/language/pronunciation";
import { generateLessonRomanization } from "@zoonk/ai/tasks/lessons/language/romanization";
import { generateLessonVocabulary } from "@zoonk/ai/tasks/lessons/language/vocabulary";
import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { prisma } from "@zoonk/db";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "../steps/_test-utils/create-lesson-context";
import { vocabularyLessonWorkflow } from "./vocabulary-workflow";

const WORKFLOW_RUN_ID = "vocabulary-workflow-test";

const { logErrorMock } = vi.hoisted(() => ({ logErrorMock: vi.fn() }));

const vocabularyState = vi.hoisted(() => ({
  distractors: {} as Record<string, string[]>,
  words: [] as { translation: string; word: string }[],
}));

vi.mock("@zoonk/ai/tasks/lessons/language/vocabulary", () => ({
  generateLessonVocabulary: vi
    .fn()
    .mockImplementation(() => ({ data: { words: vocabularyState.words } })),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/distractors", () => ({
  generateLessonDistractors: vi
    .fn()
    .mockImplementation(({ input }) =>
      Promise.resolve({ data: { distractors: vocabularyState.distractors[input] ?? [] } }),
    ),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/pronunciation", () => ({
  generateLessonPronunciation: vi
    .fn()
    .mockImplementation(({ word }) =>
      Promise.resolve({ data: { pronunciation: `${word} pronunciation` } }),
    ),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/romanization", () => ({
  generateLessonRomanization: vi
    .fn()
    .mockImplementation(({ texts }) =>
      Promise.resolve({
        data: { romanizations: texts.map((text: string) => `${text} romanized`) },
      }),
    ),
}));

vi.mock("@zoonk/core/audio/generate", () => ({
  generateLanguageAudio: vi
    .fn()
    .mockImplementation(({ text }) =>
      Promise.resolve({
        data: `https://example.com/audio/${encodeURIComponent(text)}.mp3`,
        error: null,
      }),
    ),
}));

vi.mock("@zoonk/utils/logger", () => ({ logError: logErrorMock }));

describe(vocabularyLessonWorkflow, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vocabularyState.words = [];
    vocabularyState.distractors = {};

    vi.mocked(generateLanguageAudio).mockImplementation(({ text }) =>
      Promise.resolve({
        data: `https://example.com/audio/${encodeURIComponent(text)}.mp3`,
        error: null,
      }),
    );
  });

  it("stores vocabulary words, enrichment metadata, and vocabulary steps", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const catWord = `猫-${uniqueId}`;
    const waterWord = `水-${uniqueId}`;
    const dogWord = `犬-${uniqueId}`;
    const birdWord = `鳥-${uniqueId}`;
    const fireWord = `火-${uniqueId}`;
    const earthWord = `土-${uniqueId}`;
    const allWords = [catWord, waterWord, dogWord, birdWord, fireWord, earthWord];

    const context = await createLessonContext({
      generationRunId: WORKFLOW_RUN_ID,
      generationStatus: "running",
      kind: "vocabulary",
      organizationId,
      targetLanguage: "ja",
    });

    vocabularyState.words = [
      { translation: `cat ${uniqueId}`, word: catWord },
      { translation: `water ${uniqueId}`, word: waterWord },
    ];

    vocabularyState.distractors = {
      [catWord]: [dogWord, birdWord],
      [waterWord]: [fireWord, earthWord],
    };

    await vocabularyLessonWorkflow({ context, workflowRunId: WORKFLOW_RUN_ID });

    expect(generateLessonVocabulary).toHaveBeenCalledOnce();
    expect(generateLessonDistractors).toHaveBeenCalledTimes(2);
    expect(generateLessonPronunciation).toHaveBeenCalledTimes(allWords.length);
    expect(generateLanguageAudio).toHaveBeenCalledTimes(allWords.length);

    expect(generateLessonRomanization).toHaveBeenCalledWith(
      expect.objectContaining({ texts: allWords }),
    );

    const [steps, lessonWords, words] = await Promise.all([
      prisma.step.findMany({ orderBy: { position: "asc" }, where: { lessonId: context.id } }),
      prisma.chapterWord.findMany({
        include: { word: true },
        orderBy: { word: { word: "asc" } },
        where: { sourceLessonId: context.id },
      }),
      prisma.word.findMany({
        include: { pronunciations: true },
        where: { organizationId, targetLanguage: "ja", word: { in: allWords } },
      }),
    ]);

    expect(steps.map((step) => [step.position, step.kind])).toStrictEqual([
      [0, "vocabulary"],
      [1, "vocabulary"],
    ]);

    expect(
      lessonWords
        .map((entry) => ({
          distractors: entry.distractors,
          translation: entry.translation,
          word: entry.word.word,
        }))
        .toSorted((a, b) => a.translation.localeCompare(b.translation)),
    ).toStrictEqual([
      { distractors: [dogWord, birdWord], translation: `cat ${uniqueId}`, word: catWord },
      { distractors: [fireWord, earthWord], translation: `water ${uniqueId}`, word: waterWord },
    ]);

    expect(
      words
        .map((entry) => ({
          audioUrl: entry.audioUrl,
          pronunciation: entry.pronunciations[0]?.pronunciation,
          romanization: entry.romanization,
          word: entry.word,
        }))
        .toSorted((a, b) => a.word.localeCompare(b.word)),
    ).toStrictEqual(
      allWords
        .map((word) => ({
          audioUrl: `https://example.com/audio/${encodeURIComponent(word)}.mp3`,
          pronunciation: `${word} pronunciation`,
          romanization: `${word} romanized`,
          word,
        }))
        .toSorted((a, b) => a.word.localeCompare(b.word)),
    );
  });

  it("splits more than twenty words into balanced vocabulary and translation pairs", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const context = await createLessonContext({
      generationRunId: WORKFLOW_RUN_ID,
      generationStatus: "running",
      kind: "vocabulary",
      organizationId,
      targetLanguage: "ja",
    });

    await Promise.all([
      lessonFixture({
        chapterId: context.chapterId,
        generationStatus: "pending",
        isPublished: true,
        kind: "translation",
        organizationId,
        position: context.position + 1,
        title: `Translation ${uniqueId}`,
      }),
      lessonFixture({
        chapterId: context.chapterId,
        generationStatus: "pending",
        isPublished: true,
        kind: "grammar",
        organizationId,
        position: context.position + 2,
        title: `Following grammar ${uniqueId}`,
      }),
    ]);

    vocabularyState.words = Array.from({ length: 21 }, (_, index) => ({
      translation: `Translation ${uniqueId} ${index + 1}`,
      word: `Word ${uniqueId} ${index + 1}`,
    }));

    await vocabularyLessonWorkflow({ context, workflowRunId: WORKFLOW_RUN_ID });

    const lessons = await prisma.lesson.findMany({
      include: { steps: { orderBy: { position: "asc" } } },
      orderBy: { position: "asc" },
      where: { chapterId: context.chapterId },
    });

    expect(lessons.map((lesson) => lesson.kind)).toStrictEqual([
      "vocabulary",
      "translation",
      "vocabulary",
      "translation",
      "grammar",
    ]);

    const vocabularyLessons = lessons.filter((lesson) => lesson.kind === "vocabulary");
    const translationLessons = lessons.filter((lesson) => lesson.kind === "translation");

    expect(vocabularyLessons.map((lesson) => lesson.steps.length)).toStrictEqual([11, 10]);
    expect(translationLessons.map((lesson) => lesson.steps.length)).toStrictEqual([11, 10]);

    expect(
      vocabularyLessons.map((lesson) => lesson.steps.map((step) => step.chapterWordId)),
    ).toStrictEqual(
      translationLessons.map((lesson) => lesson.steps.map((step) => step.chapterWordId)),
    );
  });

  it("saves the lesson after optional audio retries remain incomplete", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const word = `音声-${uniqueId}`;

    const context = await createLessonContext({
      generationRunId: WORKFLOW_RUN_ID,
      generationStatus: "running",
      kind: "vocabulary",
      organizationId,
      targetLanguage: "ja",
    });

    vocabularyState.words = [{ translation: `audio ${uniqueId}`, word }];

    vi.mocked(generateLanguageAudio).mockResolvedValue({
      data: null,
      error: new Error("No speech audio generated"),
    });

    await vocabularyLessonWorkflow({ context, workflowRunId: WORKFLOW_RUN_ID });

    expect(logErrorMock).toHaveBeenCalledExactlyOnceWith(
      "[Lesson Audio Generation Permanently Failed]",
      expect.objectContaining({
        error: expect.stringContaining(word),
        lessonId: context.id,
        step: "generateVocabularyAudio",
      }),
    );

    await expect(
      prisma.word.findUniqueOrThrow({
        where: { orgWord: { organizationId, targetLanguage: "ja", word } },
      }),
    ).resolves.toMatchObject({ audioUrl: null });
  });

  it("keeps canonical word enrichment when a distractor normalizes to the same key", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const canonicalWord = `Água-${uniqueId}`;
    const duplicateDistractor = `Agua-${uniqueId}`;
    const validDistractor = `水-${uniqueId}`;

    const context = await createLessonContext({
      generationRunId: WORKFLOW_RUN_ID,
      generationStatus: "running",
      kind: "vocabulary",
      organizationId,
      targetLanguage: "ja",
    });

    vocabularyState.words = [{ translation: `water ${uniqueId}`, word: canonicalWord }];
    vocabularyState.distractors = { [canonicalWord]: [duplicateDistractor, validDistractor] };

    await vocabularyLessonWorkflow({ context, workflowRunId: WORKFLOW_RUN_ID });

    const [canonicalRecord, duplicateDistractorRecord, lessonWord] = await Promise.all([
      prisma.word.findUnique({
        include: { pronunciations: true },
        where: { orgWord: { organizationId, targetLanguage: "ja", word: canonicalWord } },
      }),
      prisma.word.findUnique({
        where: { orgWord: { organizationId, targetLanguage: "ja", word: duplicateDistractor } },
      }),
      prisma.chapterWord.findFirst({
        include: { word: true },
        where: { sourceLessonId: context.id },
      }),
    ]);

    expect(canonicalRecord).toMatchObject({
      audioUrl: `https://example.com/audio/${encodeURIComponent(canonicalWord)}.mp3`,
      romanization: `${canonicalWord} romanized`,
      word: canonicalWord,
    });

    expect(canonicalRecord?.pronunciations[0]?.pronunciation).toBe(
      `${canonicalWord} pronunciation`,
    );

    expect(duplicateDistractorRecord).toBeNull();

    expect(lessonWord).toMatchObject({
      distractors: [validDistractor],
      translation: `water ${uniqueId}`,
    });

    expect(lessonWord?.word.word).toBe(canonicalWord);
  });
});
