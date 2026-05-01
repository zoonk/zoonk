import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { saveReadingLessonStep } from "./save-reading-lesson-step";

describe(saveReadingLessonStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("saves reading sentences, target words, and distractor word metadata", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const canonicalWords = [`Guten${id}`, `Morgen${id}`, `Lara${id}`] as const;
    const normalizedCanonicalWords = canonicalWords.map((word) => word.toLowerCase());
    const generatedDistractorWords = [`Abend${id}`, `Fenster${id}`] as const;
    const sentence = canonicalWords.join(" ");
    const translation = `Good morning ${id}`;

    const context = await createLessonContext({
      kind: "reading",
      organizationId,
      targetLanguage: "de",
    });

    await saveReadingLessonStep({
      context,
      distractors: { [sentence]: [...generatedDistractorWords, sentence] },
      pronunciations: {
        [generatedDistractorWords[0]]: generatedDistractorWords[0].toLowerCase(),
        [generatedDistractorWords[1]]: generatedDistractorWords[1].toLowerCase(),
        [normalizedCanonicalWords[0]!]: normalizedCanonicalWords[0]!,
        [normalizedCanonicalWords[1]!]: normalizedCanonicalWords[1]!,
        [normalizedCanonicalWords[2]!]: normalizedCanonicalWords[2]!,
      },
      sentenceAudioUrls: { [sentence]: "/audio/sentence.mp3" },
      sentenceRomanizations: { [sentence]: normalizedCanonicalWords.join(" ") },
      sentences: [{ explanation: "Greeting", sentence, translation }],
      translationDistractors: { [translation]: [`hello-${id}`, `bye-${id}`] },
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
    });

    const savedSentence = await prisma.sentence.findFirstOrThrow({
      where: { organizationId, sentence, targetLanguage: "de" },
    });

    const [lessonSentence, lessonWords, distractorLessonWords, step, pronunciations] =
      await Promise.all([
        prisma.lessonSentence.findUniqueOrThrow({
          where: { lessonSentence: { lessonId: context.id, sentenceId: savedSentence.id } },
        }),
        prisma.lessonWord.findMany({
          include: { word: true },
          orderBy: { word: { word: "asc" } },
          where: { lessonId: context.id },
        }),
        prisma.lessonWord.findMany({
          where: { lessonId: context.id, word: { word: { in: [...generatedDistractorWords] } } },
        }),
        prisma.step.findFirstOrThrow({
          where: { kind: "reading", lessonId: context.id, position: 0 },
        }),
        prisma.wordPronunciation.findMany({
          where: {
            userLanguage: "en",
            word: {
              organizationId,
              targetLanguage: "de",
              word: { in: [...generatedDistractorWords, ...normalizedCanonicalWords] },
            },
          },
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
      translationDistractors: [`hello-${id}`, `bye-${id}`],
    });

    expect(step).toMatchObject({ content: {}, isPublished: true, sentenceId: savedSentence.id });

    expect(lessonWords.map((entry) => [entry.word.word, entry.translation])).toStrictEqual([
      [normalizedCanonicalWords[0]!, `good-${id}`],
      [normalizedCanonicalWords[2]!, canonicalWords[2]],
      [normalizedCanonicalWords[1]!, `morning-${id}`],
    ]);

    expect(distractorLessonWords).toStrictEqual([]);
    expect(pronunciations).toHaveLength(5);
  });
});
