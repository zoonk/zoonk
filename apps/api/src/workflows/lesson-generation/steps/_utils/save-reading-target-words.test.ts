import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, describe, expect, it } from "vitest";
import { saveReadingWordMetadata } from "./save-reading-target-words";

describe(saveReadingWordMetadata, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("saves only canonical words with translations", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const translatedWord = `gato${id}`;
    const untranslatedWord = `bonito${id}`;

    const wordIds = await saveReadingWordMetadata({
      distractors: { [`${translatedWord} ${untranslatedWord}`]: [] },
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

    const words = await prisma.word.findMany({
      where: {
        organizationId,
        targetLanguage: "de",
        word: { in: [translatedWord, untranslatedWord] },
      },
    });

    expect(Object.keys(wordIds)).toStrictEqual([translatedWord]);
    expect(words.map((entry) => entry.word)).toStrictEqual([translatedWord]);
  });

  it("preserves a lowercase sentence word separately from existing uppercase vocabulary", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const existingWord = `Gato${id}`;
    const lowercaseWord = existingWord.toLowerCase();

    const existingRecord = await wordFixture({
      audioUrl: "/audio/gato.mp3",
      organizationId,
      targetLanguage: "de",
      word: existingWord,
    });

    const wordIds = await saveReadingWordMetadata({
      distractors: { [lowercaseWord]: [] },
      organizationId,
      pronunciations: { [lowercaseWord]: "ga-to" },
      sentences: [{ explanation: "test explanation", sentence: lowercaseWord, translation: "cat" }],
      targetLanguage: "de",
      userLanguage: "en",
      wordAudioUrls: {},
      wordMetadata: { [lowercaseWord]: { romanization: null, translation: "cat" } },
    });

    const words = await prisma.word.findMany({
      where: { organizationId, targetLanguage: "de", word: { in: [existingWord, lowercaseWord] } },
    });

    expect(words.map((word) => word.word).toSorted()).toStrictEqual(
      [existingWord, lowercaseWord].toSorted(),
    );

    expect(wordIds[lowercaseWord]).not.toBe(existingRecord.id);
  });

  it("saves distractor word metadata alongside canonical words", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const canonicalWord = `hallo${id}`;
    const distractorWord = `tschuss${id}`;

    const wordIds = await saveReadingWordMetadata({
      distractors: { [canonicalWord]: [distractorWord] },
      organizationId,
      pronunciations: { [canonicalWord]: "ha-lo", [distractorWord]: "choos" },
      sentences: [
        { explanation: "test explanation", sentence: canonicalWord, translation: "hello" },
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

    const distractorRecord = await prisma.word.findFirstOrThrow({
      where: { organizationId, targetLanguage: "de", word: distractorWord },
    });

    expect(distractorRecord.audioUrl).toBe(`/audio/${distractorWord}.mp3`);
    expect(wordIds[distractorWord]).toBe(distractorRecord.id);
  });

  it("skips distractor variants that normalize to canonical words", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const canonicalWord = `água${id}`;
    const duplicateDistractor = `agua${id}`;

    const wordIds = await saveReadingWordMetadata({
      distractors: { [canonicalWord]: [duplicateDistractor] },
      organizationId,
      pronunciations: { [canonicalWord]: "AH-gwah" },
      sentences: [
        { explanation: "test explanation", sentence: canonicalWord, translation: "water" },
      ],
      targetLanguage: "de",
      userLanguage: "en",
      wordAudioUrls: { [canonicalWord]: `/audio/${canonicalWord}.mp3` },
      wordMetadata: { [canonicalWord]: { romanization: null, translation: "water" } },
    });

    const duplicateDistractorRecord = await prisma.word.findUnique({
      where: { orgWord: { organizationId, targetLanguage: "de", word: duplicateDistractor } },
    });

    expect(Object.keys(wordIds)).toStrictEqual([canonicalWord]);
    expect(duplicateDistractorRecord).toBeNull();
  });
});
