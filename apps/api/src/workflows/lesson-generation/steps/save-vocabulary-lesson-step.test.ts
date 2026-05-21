import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { saveVocabularyLessonStep } from "./save-vocabulary-lesson-step";

describe(saveVocabularyLessonStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("saves vocabulary words, distractor metadata, and vocabulary steps", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const vocabularyWord = `boa noite ${id}`;
    const distractorWords = [`boa tarde ${id}`, `bom dia ${id}`] as const;

    const context = await createLessonContext({
      kind: "vocabulary",
      organizationId,
      targetLanguage: "pt",
    });

    await saveVocabularyLessonStep({
      context,
      distractors: { [vocabularyWord]: [...distractorWords, distractorWords[0]] },
      pronunciations: {
        [vocabularyWord]: `pron-${id}-boa-noite`,
        [distractorWords[0]]: `pron-${id}-boa-tarde`,
        [distractorWords[1]]: `pron-${id}-bom-dia`,
      },
      romanizations: {},
      wordAudioUrls: {
        [vocabularyWord]: `/audio/boa-noite-${id}.mp3`,
        [distractorWords[0]]: `/audio/boa-tarde-${id}.mp3`,
        [distractorWords[1]]: `/audio/bom-dia-${id}.mp3`,
      },
      words: [{ translation: "good evening", word: vocabularyWord }],
    });

    const [lessonWords, distractorLessonWords, words, pronunciations, steps] = await Promise.all([
      prisma.chapterWord.findMany({
        include: { word: true },
        where: { sourceLessonId: context.id },
      }),
      prisma.chapterWord.findMany({
        where: { sourceLessonId: context.id, word: { word: { in: [...distractorWords] } } },
      }),
      prisma.word.findMany({
        orderBy: { word: "asc" },
        where: {
          organizationId,
          targetLanguage: "pt",
          word: { in: [vocabularyWord, ...distractorWords] },
        },
      }),
      prisma.wordPronunciation.findMany({
        where: {
          userLanguage: "en",
          word: {
            organizationId,
            targetLanguage: "pt",
            word: { in: [vocabularyWord, ...distractorWords] },
          },
        },
      }),
      prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { kind: "vocabulary", lessonId: context.id },
      }),
    ]);

    expect(lessonWords).toHaveLength(1);

    expect(lessonWords[0]).toMatchObject({
      distractors: [...distractorWords],
      translation: "good evening",
    });

    expect(lessonWords[0]?.word.word).toBe(vocabularyWord);
    expect(distractorLessonWords).toStrictEqual([]);

    expect(words.map((entry) => [entry.word, entry.audioUrl])).toStrictEqual([
      [vocabularyWord, `/audio/boa-noite-${id}.mp3`],
      [distractorWords[0], `/audio/boa-tarde-${id}.mp3`],
      [distractorWords[1], `/audio/bom-dia-${id}.mp3`],
    ]);

    expect(pronunciations).toHaveLength(3);
    expect(steps).toHaveLength(1);

    expect(steps[0]).toMatchObject({
      chapterWordId: lessonWords[0]?.id,
      content: {},
      isPublished: true,
      position: 0,
      wordId: lessonWords[0]?.wordId,
    });
  });
});
