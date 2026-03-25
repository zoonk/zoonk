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
      targetLanguage: "es",
      userLanguage: "en",
      words: [],
    });

    expect(result).toEqual({ alternatives: {}, pronunciations: {} });
    expect(generateActivityPronunciation).not.toHaveBeenCalled();
    expect(generateWordAlternativeTranslations).not.toHaveBeenCalled();
  });

  test("generates pronunciation and writes it to the database", async () => {
    const word = await wordFixture({ organizationId });
    await createWordTranslation({ translation: "hello", wordId: word.id });

    await generateWordPronunciationAndAlternatives({
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word, wordId: Number(word.id) }],
    });

    const updated = await prisma.wordTranslation.findFirst({
      where: { userLanguage: "en", wordId: word.id },
    });

    expect(updated?.pronunciation).toBe("OH-lah");
    expect(generateActivityPronunciation).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguage: "es", userLanguage: "en", word: word.word }),
    );
  });

  test("generates alternativeTranslations and writes them to the database", async () => {
    const word = await wordFixture({ organizationId });
    await createWordTranslation({ translation: "hello", wordId: word.id });

    await generateWordPronunciationAndAlternatives({
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word, wordId: Number(word.id) }],
    });

    const updated = await prisma.wordTranslation.findFirst({
      where: { userLanguage: "en", wordId: word.id },
    });

    expect(updated?.alternativeTranslations).toEqual(["hi", "hey"]);
    expect(generateWordAlternativeTranslations).toHaveBeenCalledWith(
      expect.objectContaining({
        targetLanguage: "es",
        translation: "hello",
        userLanguage: "en",
        word: word.word,
      }),
    );
  });

  test("skips pronunciation generation for words that already have it", async () => {
    const word = await wordFixture({ organizationId });
    await createWordTranslation({
      pronunciation: "existing-pron",
      translation: "cat",
      wordId: word.id,
    });

    await generateWordPronunciationAndAlternatives({
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word, wordId: Number(word.id) }],
    });

    expect(generateActivityPronunciation).not.toHaveBeenCalled();

    const updated = await prisma.wordTranslation.findFirst({
      where: { userLanguage: "en", wordId: word.id },
    });

    expect(updated?.pronunciation).toBe("existing-pron");
  });

  test("skips alternatives generation for words that already have them", async () => {
    const word = await wordFixture({ organizationId });
    await createWordTranslation({
      alternativeTranslations: ["existing-alt"],
      translation: "good evening",
      wordId: word.id,
    });

    await generateWordPronunciationAndAlternatives({
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word, wordId: Number(word.id) }],
    });

    expect(generateWordAlternativeTranslations).not.toHaveBeenCalled();

    const updated = await prisma.wordTranslation.findFirst({
      where: { userLanguage: "en", wordId: word.id },
    });

    expect(updated?.alternativeTranslations).toEqual(["existing-alt"]);
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
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word, wordId: Number(word.id) }],
    });

    expect(generateActivityPronunciation).not.toHaveBeenCalled();
    expect(generateWordAlternativeTranslations).not.toHaveBeenCalled();
    expect(result).toEqual({ alternatives: {}, pronunciations: {} });
  });

  test("persists alternatives even when pronunciation AI fails", async () => {
    vi.mocked(generateActivityPronunciation).mockRejectedValueOnce(
      new Error("pronunciation AI failed"),
    );

    const word = await wordFixture({ organizationId });
    await createWordTranslation({ translation: "hello", wordId: word.id });

    await generateWordPronunciationAndAlternatives({
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word, wordId: Number(word.id) }],
    });

    const updated = await prisma.wordTranslation.findFirst({
      where: { userLanguage: "en", wordId: word.id },
    });

    expect(updated?.alternativeTranslations).toEqual(["hi", "hey"]);
    expect(updated?.pronunciation).toBeNull();
  });

  test("persists pronunciation even when alternatives AI fails", async () => {
    vi.mocked(generateWordAlternativeTranslations).mockRejectedValueOnce(
      new Error("alternatives AI failed"),
    );

    const word = await wordFixture({ organizationId });
    await createWordTranslation({ translation: "hello", wordId: word.id });

    await generateWordPronunciationAndAlternatives({
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word, wordId: Number(word.id) }],
    });

    const updated = await prisma.wordTranslation.findFirst({
      where: { userLanguage: "en", wordId: word.id },
    });

    expect(updated?.pronunciation).toBe("OH-lah");
    expect(updated?.alternativeTranslations).toEqual([]);
  });

  test("returns generated enrichments in the result", async () => {
    const word = await wordFixture({ organizationId });
    await createWordTranslation({ translation: "hello", wordId: word.id });

    const result = await generateWordPronunciationAndAlternatives({
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word, wordId: Number(word.id) }],
    });

    expect(result.pronunciations[word.word]).toBe("OH-lah");
    expect(result.alternatives[word.word]).toEqual(["hi", "hey"]);
  });

  test("does not overwrite with empty alternatives when AI returns empty array", async () => {
    vi.mocked(generateWordAlternativeTranslations).mockResolvedValueOnce({
      data: { alternativeTranslations: [] },
    } as unknown as Awaited<ReturnType<typeof generateWordAlternativeTranslations>>);

    const word = await wordFixture({ organizationId });
    await createWordTranslation({ translation: "cat", wordId: word.id });

    await generateWordPronunciationAndAlternatives({
      targetLanguage: "es",
      userLanguage: "en",
      words: [{ word: word.word, wordId: Number(word.id) }],
    });

    const updated = await prisma.wordTranslation.findFirst({
      where: { userLanguage: "en", wordId: word.id },
    });

    // The persist logic guards with `alternatives.length > 0`, so an empty
    // AI result does not trigger a DB write for alternativeTranslations.
    expect(updated?.alternativeTranslations).toEqual([]);
  });

  test("enriches multiple words in a single call", async () => {
    const [word1, word2] = await Promise.all([
      wordFixture({ organizationId }),
      wordFixture({ organizationId }),
    ]);

    await Promise.all([
      createWordTranslation({ translation: "hello", wordId: word1.id }),
      createWordTranslation({ translation: "cat", wordId: word2.id }),
    ]);

    const result = await generateWordPronunciationAndAlternatives({
      targetLanguage: "es",
      userLanguage: "en",
      words: [
        { word: word1.word, wordId: Number(word1.id) },
        { word: word2.word, wordId: Number(word2.id) },
      ],
    });

    expect(Object.keys(result.pronunciations)).toHaveLength(2);
    expect(Object.keys(result.alternatives)).toHaveLength(2);
    expect(generateActivityPronunciation).toHaveBeenCalledTimes(2);
    expect(generateWordAlternativeTranslations).toHaveBeenCalledTimes(2);

    const [updated1, updated2] = await Promise.all([
      prisma.wordTranslation.findFirst({ where: { userLanguage: "en", wordId: word1.id } }),
      prisma.wordTranslation.findFirst({ where: { userLanguage: "en", wordId: word2.id } }),
    ]);

    expect(updated1?.pronunciation).toBe("OH-lah");
    expect(updated1?.alternativeTranslations).toEqual(["hi", "hey"]);
    expect(updated2?.pronunciation).toBe("OH-lah");
    expect(updated2?.alternativeTranslations).toEqual(["hi", "hey"]);
  });

  test("only enriches missing fields in a mixed batch", async () => {
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
      targetLanguage: "es",
      userLanguage: "en",
      words: [
        { word: needsBoth.word, wordId: Number(needsBoth.id) },
        { word: needsPronOnly.word, wordId: Number(needsPronOnly.id) },
        { word: needsAltsOnly.word, wordId: Number(needsAltsOnly.id) },
      ],
    });

    // Pronunciation: called for needsBoth + needsPronOnly (2), not needsAltsOnly
    expect(generateActivityPronunciation).toHaveBeenCalledTimes(2);

    // Alternatives: called for needsBoth + needsAltsOnly (2), not needsPronOnly
    expect(generateWordAlternativeTranslations).toHaveBeenCalledTimes(2);

    const [updatedBoth, updatedPronOnly, updatedAltsOnly] = await Promise.all([
      prisma.wordTranslation.findFirst({ where: { userLanguage: "en", wordId: needsBoth.id } }),
      prisma.wordTranslation.findFirst({
        where: { userLanguage: "en", wordId: needsPronOnly.id },
      }),
      prisma.wordTranslation.findFirst({
        where: { userLanguage: "en", wordId: needsAltsOnly.id },
      }),
    ]);

    expect(updatedBoth?.pronunciation).toBe("OH-lah");
    expect(updatedBoth?.alternativeTranslations).toEqual(["hi", "hey"]);

    expect(updatedPronOnly?.pronunciation).toBe("OH-lah");
    expect(updatedPronOnly?.alternativeTranslations).toEqual(["kitty"]);

    expect(updatedAltsOnly?.pronunciation).toBe("existing-pron");
    expect(updatedAltsOnly?.alternativeTranslations).toEqual(["hi", "hey"]);
  });
});
