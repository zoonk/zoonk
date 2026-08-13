import { randomUUID } from "node:crypto";
import { generateLessonDistractors } from "@zoonk/ai/tasks/lessons/language/distractors";
import { generateLessonPronunciation } from "@zoonk/ai/tasks/lessons/language/pronunciation";
import { generateLessonSentences } from "@zoonk/ai/tasks/lessons/language/sentences";
import { generateTranslation } from "@zoonk/ai/tasks/lessons/language/translation";
import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { prisma } from "@zoonk/db";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "../steps/_test-utils/create-lesson-context";
import { readingLessonWorkflow } from "./reading-workflow";

const WORKFLOW_RUN_ID = "reading-workflow-test";

const readingState = vi.hoisted(() => ({
  distractors: {} as Record<string, string[]>,
  sentence: "",
  sentences: [] as { explanation: string; sentence: string; translation: string }[],
  translation: "",
}));

vi.mock("@zoonk/ai/tasks/lessons/language/sentences", () => ({
  generateLessonSentences: vi
    .fn()
    .mockImplementation(() => ({
      data: {
        sentences:
          readingState.sentences.length > 0
            ? readingState.sentences
            : [
                {
                  explanation: "Greeting sentence.",
                  sentence: readingState.sentence,
                  translation: readingState.translation,
                },
              ],
      },
    })),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/distractors", () => ({
  generateLessonDistractors: vi
    .fn()
    .mockImplementation(({ input }) =>
      Promise.resolve({ data: { distractors: readingState.distractors[input] ?? [] } }),
    ),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/translation", () => ({
  generateTranslation: vi
    .fn()
    .mockImplementation(({ word }) =>
      Promise.resolve({ data: { translation: `${word} translated` } }),
    ),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/pronunciation", () => ({
  generateLessonPronunciation: vi
    .fn()
    .mockImplementation(({ word }) =>
      Promise.resolve({ data: { pronunciation: `${word} pronunciation` } }),
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

describe(readingLessonWorkflow, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    readingState.distractors = {};
    readingState.sentence = "";
    readingState.sentences = [];
    readingState.translation = "";

    vi.mocked(generateLanguageAudio).mockImplementation(({ text }) =>
      Promise.resolve({
        data: `https://example.com/audio/${encodeURIComponent(text)}.mp3`,
        error: null,
      }),
    );
  });

  it("stores reading sentences and word metadata from vocabulary lesson metadata", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const sourceWords = [`guten${uniqueId}`, `morgen${uniqueId}`];
    const sentence = sourceWords.join(" ");
    const translation = `good morning ${uniqueId}`;

    const context = await createLessonContext({
      generationRunId: WORKFLOW_RUN_ID,
      generationStatus: "running",
      kind: "reading",
      organizationId,
      position: 2,
      targetLanguage: "de",
    });

    const vocabularyLesson = await lessonFixture({
      chapterId: context.chapterId,
      description: `German greeting words ${uniqueId}`,
      generationStatus: "pending",
      isPublished: true,
      kind: "vocabulary",
      organizationId,
      position: 1,
      title: `Greeting Vocabulary ${uniqueId}`,
    });

    readingState.sentence = sentence;
    readingState.translation = translation;

    readingState.distractors = {
      [sentence]: [`abend-${uniqueId}`, `fenster-${uniqueId}`],
      [translation]: [`hello-${uniqueId}`, `bye-${uniqueId}`],
    };

    await readingLessonWorkflow({ context, workflowRunId: WORKFLOW_RUN_ID });

    expect(generateLessonSentences).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLessons: [
          {
            description: `German greeting words ${uniqueId}`,
            title: `Greeting Vocabulary ${uniqueId}`,
          },
        ],
      }),
    );

    expect(vocabularyLesson.generationStatus).toBe("pending");
    expect(generateLessonDistractors).toHaveBeenCalledTimes(2);
    expect(generateTranslation).toHaveBeenCalledTimes(sourceWords.length);
    expect(generateLessonPronunciation).toHaveBeenCalledTimes(sourceWords.length + 2);
    expect(generateLanguageAudio).toHaveBeenCalledTimes(sourceWords.length + 3);

    const savedSentence = await prisma.sentence.findFirstOrThrow({
      where: { organizationId, sentence, targetLanguage: "de" },
    });

    const [step, lessonSentence, lessonWords] = await Promise.all([
      prisma.step.findFirstOrThrow({ where: { lessonId: context.id, position: 0 } }),
      prisma.chapterSentence.findUniqueOrThrow({
        where: {
          chapterSentenceSource: { sentenceId: savedSentence.id, sourceLessonId: context.id },
        },
      }),
      prisma.chapterWord.findMany({
        include: { word: true },
        orderBy: { word: { word: "asc" } },
        where: { sourceLessonId: context.id },
      }),
    ]);

    expect(savedSentence).toMatchObject({
      audioUrl: `https://example.com/audio/${encodeURIComponent(sentence)}.mp3`,
      sentence,
    });

    expect(step).toMatchObject({
      chapterSentenceId: lessonSentence.id,
      kind: "reading",
      sentenceId: savedSentence.id,
    });

    expect(lessonSentence).toMatchObject({
      distractors: [`abend-${uniqueId}`, `fenster-${uniqueId}`],
      explanation: "Greeting sentence.",
      translation,
      translationDistractors: [`hello-${uniqueId}`, `bye-${uniqueId}`],
    });

    expect(lessonWords.map((entry) => [entry.word.word, entry.translation])).toStrictEqual([
      [sourceWords[0], `${sourceWords[0]} translated`],
      [sourceWords[1], `${sourceWords[1]} translated`],
    ]);
  });

  it("splits more than twenty sentences into balanced reading and listening pairs", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const context = await createLessonContext({
      generationRunId: WORKFLOW_RUN_ID,
      generationStatus: "running",
      kind: "reading",
      organizationId,
      position: 2,
      targetLanguage: "de",
    });

    await Promise.all([
      lessonFixture({
        chapterId: context.chapterId,
        description: `German source ${uniqueId}`,
        generationStatus: "completed",
        isPublished: true,
        kind: "vocabulary",
        organizationId,
        position: 1,
        title: `German Vocabulary ${uniqueId}`,
      }),
      lessonFixture({
        chapterId: context.chapterId,
        generationStatus: "pending",
        isPublished: true,
        kind: "listening",
        organizationId,
        position: 3,
        title: `Listening ${uniqueId}`,
      }),
      lessonFixture({
        chapterId: context.chapterId,
        generationStatus: "pending",
        isPublished: true,
        kind: "grammar",
        organizationId,
        position: 4,
        title: `Following grammar ${uniqueId}`,
      }),
    ]);

    readingState.sentences = Array.from({ length: 21 }, (_, index) => ({
      explanation: `Explanation ${index + 1}`,
      sentence: `Satz${uniqueId}${index + 1}`,
      translation: `Sentence ${uniqueId} ${index + 1}`,
    }));

    await readingLessonWorkflow({ context, workflowRunId: WORKFLOW_RUN_ID });

    const lessons = await prisma.lesson.findMany({
      include: { steps: { orderBy: { position: "asc" } } },
      orderBy: { position: "asc" },
      where: { chapterId: context.chapterId },
    });

    expect(lessons.map((lesson) => lesson.kind)).toStrictEqual([
      "vocabulary",
      "reading",
      "listening",
      "reading",
      "listening",
      "grammar",
    ]);

    const readingLessons = lessons.filter((lesson) => lesson.kind === "reading");
    const listeningLessons = lessons.filter((lesson) => lesson.kind === "listening");

    expect(readingLessons.map((lesson) => lesson.steps.length)).toStrictEqual([11, 10]);
    expect(listeningLessons.map((lesson) => lesson.steps.length)).toStrictEqual([11, 10]);

    expect(
      readingLessons.map((lesson) => lesson.steps.map((step) => step.chapterSentenceId)),
    ).toStrictEqual(
      listeningLessons.map((lesson) => lesson.steps.map((step) => step.chapterSentenceId)),
    );

    await expect(
      Promise.all(
        readingLessons.map((lesson) =>
          prisma.chapterWord.count({ where: { sourceLessonId: lesson.id } }),
        ),
      ),
    ).resolves.toStrictEqual([11, 10]);

    await expect(prisma.lesson.count({ where: { chapterId: context.chapterId } })).resolves.toBe(6);
  });

  it("saves the lesson after optional sentence audio retries remain incomplete", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const sentence = `satz${uniqueId}`;

    const context = await createLessonContext({
      generationRunId: WORKFLOW_RUN_ID,
      generationStatus: "running",
      kind: "reading",
      organizationId,
      position: 2,
      targetLanguage: "de",
    });

    await lessonFixture({
      chapterId: context.chapterId,
      description: `German source ${uniqueId}`,
      generationStatus: "pending",
      isPublished: true,
      kind: "vocabulary",
      organizationId,
      position: 1,
      title: `German Vocabulary ${uniqueId}`,
    });

    readingState.sentence = sentence;
    readingState.translation = `sentence ${uniqueId}`;

    vi.mocked(generateLanguageAudio).mockImplementation(({ text }) =>
      Promise.resolve(
        text === sentence
          ? { data: null, error: new Error("No speech audio generated") }
          : { data: `https://example.com/audio/${encodeURIComponent(text)}.mp3`, error: null },
      ),
    );

    await readingLessonWorkflow({ context, workflowRunId: WORKFLOW_RUN_ID });

    await expect(
      prisma.sentence.findFirstOrThrow({
        where: { organizationId, sentence, targetLanguage: "de" },
      }),
    ).resolves.toMatchObject({ audioUrl: null });
  });

  it("keeps canonical word metadata when a reading distractor normalizes to the same key", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const canonicalWord = `água${uniqueId}`;
    const duplicateDistractor = `agua${uniqueId}`;
    const validDistractor = `mizu${uniqueId}`;
    const translation = `water ${uniqueId}`;

    const context = await createLessonContext({
      generationRunId: WORKFLOW_RUN_ID,
      generationStatus: "running",
      kind: "reading",
      organizationId,
      position: 2,
      targetLanguage: "de",
    });

    await lessonFixture({
      chapterId: context.chapterId,
      description: `Portuguese water words ${uniqueId}`,
      generationStatus: "pending",
      isPublished: true,
      kind: "vocabulary",
      organizationId,
      position: 1,
      title: `Water Vocabulary ${uniqueId}`,
    });

    readingState.sentence = canonicalWord;
    readingState.translation = translation;
    readingState.distractors = { [canonicalWord]: [duplicateDistractor, validDistractor] };

    await readingLessonWorkflow({ context, workflowRunId: WORKFLOW_RUN_ID });

    const [canonicalRecord, duplicateDistractorRecord, validDistractorRecord, lessonWord] =
      await Promise.all([
        prisma.word.findUnique({
          include: { pronunciations: true },
          where: { orgWord: { organizationId, targetLanguage: "de", word: canonicalWord } },
        }),
        prisma.word.findUnique({
          where: { orgWord: { organizationId, targetLanguage: "de", word: duplicateDistractor } },
        }),
        prisma.word.findUnique({
          where: { orgWord: { organizationId, targetLanguage: "de", word: validDistractor } },
        }),
        prisma.chapterWord.findFirst({
          include: { word: true },
          where: { sourceLessonId: context.id },
        }),
      ]);

    expect(canonicalRecord).toMatchObject({
      audioUrl: `https://example.com/audio/${encodeURIComponent(canonicalWord)}.mp3`,
      word: canonicalWord,
    });

    expect(canonicalRecord?.pronunciations[0]?.pronunciation).toBe(
      `${canonicalWord} pronunciation`,
    );

    expect(duplicateDistractorRecord).toBeNull();

    expect(validDistractorRecord).toMatchObject({
      audioUrl: `https://example.com/audio/${encodeURIComponent(validDistractor)}.mp3`,
      word: validDistractor,
    });

    expect(lessonWord).toMatchObject({ translation: `${canonicalWord} translated` });
    expect(lessonWord?.word.word).toBe(canonicalWord);
  });
});
