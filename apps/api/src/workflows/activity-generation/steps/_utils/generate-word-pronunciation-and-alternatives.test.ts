import { generateActivityPronunciation } from "@zoonk/ai/tasks/activities/language/pronunciation";
import { generateWordAlternativeTranslations } from "@zoonk/ai/tasks/activities/language/word-alternative-translations";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateWordPronunciationAndAlternatives } from "./generate-word-pronunciation-and-alternatives";

vi.mock("@zoonk/ai/tasks/activities/language/pronunciation", () => ({
  generateActivityPronunciation: vi.fn().mockResolvedValue({
    data: { pronunciation: "OH-lah" },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/language/word-alternative-translations", () => ({
  generateWordAlternativeTranslations: vi.fn().mockResolvedValue({
    data: { alternativeTranslations: ["hi", "hey"] },
  }),
}));

/**
 * Creates a WordTranslation record with explicit control over nullable fields.
 * The wordTranslationFixture defaults pronunciation to a non-null value,
 * which prevents testing the "missing pronunciation" path.
 */
async function createWordTranslation(attrs: {
  alternativeTranslations?: string[];
  pronunciation?: string | null;
  translation: string;
  userLanguage?: string;
  wordId: bigint;
}) {
  return prisma.wordTranslation.create({
    data: {
      alternativeTranslations: attrs.alternativeTranslations ?? [],
      pronunciation: attrs.pronunciation,
      translation: attrs.translation,
      userLanguage: attrs.userLanguage ?? "en",
      wordId: attrs.wordId,
    },
  });
}

describe(generateWordPronunciationAndAlternatives, () => {
  let organizationId: number;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns empty results when words array is empty", async () => {
    const result = await generateWordPronunciationAndAlternatives({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [],
    });

    expect(result).toEqual({ alternatives: {}, pronunciations: {} });
    expect(generateActivityPronunciation).not.toHaveBeenCalled();
    expect(generateWordAlternativeTranslations).not.toHaveBeenCalled();
  });

  test("generates pronunciation and returns it without writing to the database", async () => {
    const word = await wordFixture({ organizationId });
    await createWordTranslation({ translation: "hello", wordId: word.id });

    const result = await generateWordPronunciationAndAlternatives({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word }],
    });

    expect(result.pronunciations[word.word]).toBe("OH-lah");
    expect(generateActivityPronunciation).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguage: "es", userLanguage: "en", word: word.word }),
    );

    // Verify the function did NOT write to the database
    const dbRecord = await prisma.wordTranslation.findFirst({
      where: { userLanguage: "en", wordId: word.id },
    });

    expect(dbRecord?.pronunciation).toBeNull();
  });

  test("generates alternativeTranslations and returns them without writing to the database", async () => {
    const word = await wordFixture({ organizationId });
    await createWordTranslation({ translation: "hello", wordId: word.id });

    const result = await generateWordPronunciationAndAlternatives({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word }],
    });

    expect(result.alternatives[word.word]).toEqual(["hi", "hey"]);
    expect(generateWordAlternativeTranslations).toHaveBeenCalledWith(
      expect.objectContaining({
        targetLanguage: "es",
        translation: "hello",
        userLanguage: "en",
        word: word.word,
      }),
    );

    // Verify the function did NOT write to the database
    const dbRecord = await prisma.wordTranslation.findFirst({
      where: { userLanguage: "en", wordId: word.id },
    });

    expect(dbRecord?.alternativeTranslations).toEqual([]);
  });

  test("skips pronunciation generation for words that already have it", async () => {
    const word = await wordFixture({ organizationId });
    await createWordTranslation({
      pronunciation: "existing-pron",
      translation: "cat",
      wordId: word.id,
    });

    await generateWordPronunciationAndAlternatives({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word }],
    });

    expect(generateActivityPronunciation).not.toHaveBeenCalled();
  });

  test("skips alternatives generation for words that already have them", async () => {
    const word = await wordFixture({ organizationId });
    await createWordTranslation({
      alternativeTranslations: ["existing-alt"],
      translation: "good evening",
      wordId: word.id,
    });

    await generateWordPronunciationAndAlternatives({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word }],
    });

    expect(generateWordAlternativeTranslations).not.toHaveBeenCalled();
  });

  test("skips both when word already has pronunciation and alternatives", async () => {
    const word = await wordFixture({ organizationId });
    await createWordTranslation({
      alternativeTranslations: ["good night"],
      pronunciation: "BOH-ah NOY-chee",
      translation: "good evening",
      wordId: word.id,
    });

    const result = await generateWordPronunciationAndAlternatives({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word }],
    });

    expect(generateActivityPronunciation).not.toHaveBeenCalled();
    expect(generateWordAlternativeTranslations).not.toHaveBeenCalled();
    expect(result).toEqual({ alternatives: {}, pronunciations: {} });
  });

  test("returns alternatives even when pronunciation AI fails", async () => {
    vi.mocked(generateActivityPronunciation).mockRejectedValueOnce(
      new Error("pronunciation AI failed"),
    );

    const word = await wordFixture({ organizationId });
    await createWordTranslation({ translation: "hello", wordId: word.id });

    const result = await generateWordPronunciationAndAlternatives({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word }],
    });

    expect(result.alternatives[word.word]).toEqual(["hi", "hey"]);
    expect(result.pronunciations[word.word]).toBeUndefined();
  });

  test("returns pronunciation even when alternatives AI fails", async () => {
    vi.mocked(generateWordAlternativeTranslations).mockRejectedValueOnce(
      new Error("alternatives AI failed"),
    );

    const word = await wordFixture({ organizationId });
    await createWordTranslation({ translation: "hello", wordId: word.id });

    const result = await generateWordPronunciationAndAlternatives({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word }],
    });

    expect(result.pronunciations[word.word]).toBe("OH-lah");
    expect(result.alternatives[word.word]).toBeUndefined();
  });

  test("returns generated pronunciation and alternatives in the result", async () => {
    const word = await wordFixture({ organizationId });
    await createWordTranslation({ translation: "hello", wordId: word.id });

    const result = await generateWordPronunciationAndAlternatives({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word }],
    });

    expect(result.pronunciations[word.word]).toBe("OH-lah");
    expect(result.alternatives[word.word]).toEqual(["hi", "hey"]);
  });

  test("generates pronunciation and alternatives for multiple words in a single call", async () => {
    const [word1, word2] = await Promise.all([
      wordFixture({ organizationId }),
      wordFixture({ organizationId }),
    ]);

    await Promise.all([
      createWordTranslation({ translation: "hello", wordId: word1.id }),
      createWordTranslation({ translation: "cat", wordId: word2.id }),
    ]);

    const result = await generateWordPronunciationAndAlternatives({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word1.word }, { word: word2.word }],
    });

    expect(Object.keys(result.pronunciations)).toHaveLength(2);
    expect(Object.keys(result.alternatives)).toHaveLength(2);
    expect(generateActivityPronunciation).toHaveBeenCalledTimes(2);
    expect(generateWordAlternativeTranslations).toHaveBeenCalledTimes(2);
  });

  test("only generates missing fields in a mixed batch", async () => {
    const [needsBoth, needsPronOnly, needsAltsOnly] = await Promise.all([
      wordFixture({ organizationId }),
      wordFixture({ organizationId }),
      wordFixture({ organizationId }),
    ]);

    await Promise.all([
      createWordTranslation({
        translation: "hello",
        wordId: needsBoth.id,
      }),
      createWordTranslation({
        alternativeTranslations: ["kitty"],
        pronunciation: null,
        translation: "cat",
        wordId: needsPronOnly.id,
      }),
      createWordTranslation({
        pronunciation: "existing-pron",
        translation: "dog",
        wordId: needsAltsOnly.id,
      }),
    ]);

    await generateWordPronunciationAndAlternatives({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: needsBoth.word }, { word: needsPronOnly.word }, { word: needsAltsOnly.word }],
    });

    // Pronunciation: called for needsBoth + needsPronOnly (2), not needsAltsOnly
    expect(generateActivityPronunciation).toHaveBeenCalledTimes(2);

    // Alternatives: called for needsBoth + needsAltsOnly (2), not needsPronOnly
    expect(generateWordAlternativeTranslations).toHaveBeenCalledTimes(2);
  });

  test("generates pronunciation for words not yet in the database", async () => {
    const result = await generateWordPronunciationAndAlternatives({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: "completamente-nuevo" }],
    });

    expect(generateActivityPronunciation).toHaveBeenCalledWith(
      expect.objectContaining({ word: "completamente-nuevo" }),
    );
    expect(result.pronunciations["completamente-nuevo"]).toBe("OH-lah");
  });

  test("generates alternatives for new words when translation is provided", async () => {
    const result = await generateWordPronunciationAndAlternatives({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ translation: "completely", word: "completamente-con-trad" }],
    });

    expect(generateWordAlternativeTranslations).toHaveBeenCalledWith(
      expect.objectContaining({
        translation: "completely",
        word: "completamente-con-trad",
      }),
    );
    expect(result.alternatives["completamente-con-trad"]).toEqual(["hi", "hey"]);
  });

  test("skips alternatives for new words without translation", async () => {
    await generateWordPronunciationAndAlternatives({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: "sin-traduccion" }],
    });

    // Pronunciation should still be generated
    expect(generateActivityPronunciation).toHaveBeenCalledOnce();
    // No translation provided → alternatives skipped
    expect(generateWordAlternativeTranslations).not.toHaveBeenCalled();
  });
});
