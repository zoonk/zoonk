import { randomUUID } from "node:crypto";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { wordFixture, wordPronunciationFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { generateWordPronunciations } from "./generate-word-pronunciations";

const { generateLessonPronunciationMock } = vi.hoisted(() => ({
  generateLessonPronunciationMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/pronunciation", () => ({
  generateLessonPronunciation: generateLessonPronunciationMock,
}));

describe(generateWordPronunciations, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty object for empty word list", async () => {
    const result = await generateWordPronunciations({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [],
    });

    expect(result).toStrictEqual({});
  });

  it("returns existing pronunciations without calling AI", async () => {
    const id = randomUUID().slice(0, 8);
    const wordText = `Hola${id}`;
    const word = await wordFixture({ organizationId, targetLanguage: "es", word: wordText });

    await wordPronunciationFixture({
      pronunciation: "OH-lah",
      userLanguage: "en",
      wordId: word.id,
    });

    const result = await generateWordPronunciations({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [wordText],
    });

    expect(result[wordText]).toBe("OH-lah");
    expect(generateLessonPronunciationMock).not.toHaveBeenCalled();
  });

  it("generates pronunciations for words without existing records", async () => {
    const id = randomUUID().slice(0, 8);
    const wordText = `Nuevo${id}`;

    generateLessonPronunciationMock.mockResolvedValue({ data: { pronunciation: "NWEH-voh" } });

    const result = await generateWordPronunciations({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [wordText],
    });

    expect(result[wordText]).toBe("NWEH-voh");

    expect(generateLessonPronunciationMock).toHaveBeenCalledWith({
      targetLanguage: "es",
      userLanguage: "en",
      word: wordText,
    });
  });

  it("mixes existing and generated pronunciations", async () => {
    const id = randomUUID().slice(0, 8);
    const existingWordText = `Gato${id}`;
    const newWordText = `Perro${id}`;

    const word = await wordFixture({
      organizationId,
      targetLanguage: "es",
      word: existingWordText,
    });

    await wordPronunciationFixture({
      pronunciation: "GAH-toh",
      userLanguage: "en",
      wordId: word.id,
    });

    generateLessonPronunciationMock.mockResolvedValue({ data: { pronunciation: "PEH-rroh" } });

    const result = await generateWordPronunciations({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [existingWordText, newWordText],
    });

    expect(result[existingWordText]).toBe("GAH-toh");
    expect(result[newWordText]).toBe("PEH-rroh");
    expect(generateLessonPronunciationMock).toHaveBeenCalledOnce();
  });

  it("does not reuse a pronunciation from a case-distinct word", async () => {
    const id = randomUUID().slice(0, 8);
    const existingWordText = `Morgen${id}`;
    const requestedWordText = `morgen${id}`;

    const word = await wordFixture({
      organizationId,
      targetLanguage: "de",
      word: existingWordText,
    });

    await wordPronunciationFixture({
      pronunciation: "existing",
      userLanguage: "en",
      wordId: word.id,
    });

    generateLessonPronunciationMock.mockResolvedValue({ data: { pronunciation: "generated" } });

    const result = await generateWordPronunciations({
      organizationId,
      targetLanguage: "de",
      userLanguage: "en",
      words: [requestedWordText],
    });

    expect(result[requestedWordText]).toBe("generated");

    expect(generateLessonPronunciationMock).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ word: requestedWordText }),
    );
  });

  it("throws when an AI call fails", async () => {
    const id = randomUUID().slice(0, 8);
    const wordText = `Fallo${id}`;

    generateLessonPronunciationMock.mockRejectedValue(new Error("AI failure"));

    await expect(
      generateWordPronunciations({
        organizationId,
        targetLanguage: "es",
        userLanguage: "en",
        words: [wordText],
      }),
    ).rejects.toThrow("AI failure");
  });
});
