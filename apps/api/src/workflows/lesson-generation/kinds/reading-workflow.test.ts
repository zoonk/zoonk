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

const readingState = vi.hoisted(() => ({
  distractors: {} as Record<string, string[]>,
  sentence: "",
  translation: "",
}));

vi.mock("@zoonk/ai/tasks/lessons/language/sentences", () => ({
  generateLessonSentences: vi
    .fn()
    .mockImplementation(() => ({
      data: {
        sentences: [
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
    readingState.translation = "";
  });

  it("stores reading sentences and word metadata from vocabulary lesson metadata", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const sourceWords = [`guten${uniqueId}`, `morgen${uniqueId}`];
    const sentence = sourceWords.join(" ");
    const translation = `good morning ${uniqueId}`;

    const context = await createLessonContext({
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

    await readingLessonWorkflow(context);

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

  it("keeps canonical word metadata when a reading distractor normalizes to the same key", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const canonicalWord = `água${uniqueId}`;
    const duplicateDistractor = `agua${uniqueId}`;
    const validDistractor = `mizu${uniqueId}`;
    const translation = `water ${uniqueId}`;

    const context = await createLessonContext({
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

    await readingLessonWorkflow(context);

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
