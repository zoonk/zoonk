import { randomUUID } from "node:crypto";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { wordFixture, wordPronunciationFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateWordPronunciations } from "./generate-word-pronunciations";

const { generateActivityPronunciationMock } = vi.hoisted(() => ({
  generateActivityPronunciationMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/language/pronunciation", () => ({
  generateActivityPronunciation: generateActivityPronunciationMock,
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

  test("returns empty object for empty word list", async () => {
    const result = await generateWordPronunciations({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [],
    });

    expect(result).toEqual({});
  });

  test("returns existing pronunciations without calling AI", async () => {
    const id = randomUUID().slice(0, 8);
    const wordText = `Hola${id}`;

    const word = await wordFixture({
      organizationId,
      targetLanguage: "es",
      word: wordText,
    });

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
    expect(generateActivityPronunciationMock).not.toHaveBeenCalled();
  });

  test("generates pronunciations for words without existing records", async () => {
    const id = randomUUID().slice(0, 8);
    const wordText = `Nuevo${id}`;

    generateActivityPronunciationMock.mockResolvedValue({
      data: { pronunciation: "NWEH-voh" },
    });

    const result = await generateWordPronunciations({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [wordText],
    });

    expect(result[wordText]).toBe("NWEH-voh");

    expect(generateActivityPronunciationMock).toHaveBeenCalledWith({
      targetLanguage: "es",
      userLanguage: "en",
      word: wordText,
    });
  });

  test("mixes existing and generated pronunciations", async () => {
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

    generateActivityPronunciationMock.mockResolvedValue({
      data: { pronunciation: "PEH-rroh" },
    });

    const result = await generateWordPronunciations({
      organizationId,
      targetLanguage: "es",
      userLanguage: "en",
      words: [existingWordText, newWordText],
    });

    expect(result[existingWordText]).toBe("GAH-toh");
    expect(result[newWordText]).toBe("PEH-rroh");
    expect(generateActivityPronunciationMock).toHaveBeenCalledOnce();
  });

  test("throws when an AI call fails", async () => {
    const id = randomUUID().slice(0, 8);
    const wordText = `Fallo${id}`;

    generateActivityPronunciationMock.mockRejectedValue(new Error("AI failure"));

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
