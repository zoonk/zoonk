import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { generateWordAudioUrls } from "./generate-word-audio-urls";

const { generateLanguageAudioMock, logErrorMock } = vi.hoisted(() => ({
  generateLanguageAudioMock: vi.fn(),
  logErrorMock: vi.fn(),
}));

vi.mock("@zoonk/core/audio/generate", () => ({
  generateLanguageAudio: generateLanguageAudioMock.mockImplementation(
    ({ text }: { text: string }) => Promise.resolve({ data: `/audio/${text}.mp3`, error: null }),
  ),
}));

vi.mock("@zoonk/utils/logger", () => ({ logError: logErrorMock }));

describe(generateWordAudioUrls, () => {
  let organizationId: string;
  let orgSlug: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    orgSlug = organization.slug;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    generateLanguageAudioMock.mockImplementation(({ text }: { text: string }) =>
      Promise.resolve({ data: `/audio/${text}.mp3`, error: null }),
    );
  });

  it("generates audio for words without existing records", async () => {
    const id = randomUUID().slice(0, 8);
    const word = `nuevo-${id}`;

    const result = await generateWordAudioUrls({
      orgSlug,
      organizationId,
      targetLanguage: "es",
      words: [word],
    });

    expect(result[word]).toBe(`/audio/${word}.mp3`);

    expect(generateLanguageAudioMock).toHaveBeenCalledWith(
      expect.objectContaining({ language: "es", text: word }),
    );
  });

  it("reuses existing audio without calling TTS", async () => {
    const id = randomUUID().slice(0, 8);
    const wordText = `gato-${id}`;

    await wordFixture({
      audioUrl: "/audio/existing-gato.mp3",
      organizationId,
      targetLanguage: "es",
      word: wordText,
    });

    const result = await generateWordAudioUrls({
      orgSlug,
      organizationId,
      targetLanguage: "es",
      words: [wordText],
    });

    expect(result[wordText]).toBe("/audio/existing-gato.mp3");
    expect(generateLanguageAudioMock).not.toHaveBeenCalled();
  });

  it("mixes existing and generated audio", async () => {
    const id = randomUUID().slice(0, 8);
    const existingWord = `perro-${id}`;
    const newWord = `casa-${id}`;

    await wordFixture({
      audioUrl: "/audio/existing-perro.mp3",
      organizationId,
      targetLanguage: "es",
      word: existingWord,
    });

    const result = await generateWordAudioUrls({
      orgSlug,
      organizationId,
      targetLanguage: "es",
      words: [existingWord, newWord],
    });

    expect(result[existingWord]).toBe("/audio/existing-perro.mp3");
    expect(result[newWord]).toBe(`/audio/${newWord}.mp3`);
    expect(generateLanguageAudioMock).toHaveBeenCalledOnce();
  });

  it("throws for retry after saving successful audio and only retries missing words", async () => {
    const id = randomUUID().slice(0, 8);
    const successfulWord = `casa-${id}`;
    const failedWord = `fallo-${id}`;

    generateLanguageAudioMock.mockImplementation(({ text }: { text: string }) =>
      Promise.resolve(
        text === failedWord
          ? { data: null, error: new Error("No speech audio generated") }
          : { data: `/audio/${text}.mp3`, error: null },
      ),
    );

    await expect(
      generateWordAudioUrls({
        orgSlug,
        organizationId,
        targetLanguage: "es",
        words: [successfulWord, failedWord],
      }),
    ).rejects.toThrow(`optionalAudioGenerationIncomplete:${failedWord}`);

    expect(logErrorMock).not.toHaveBeenCalled();

    await expect(
      prisma.word.findUniqueOrThrow({
        where: { orgWord: { organizationId, targetLanguage: "es", word: successfulWord } },
      }),
    ).resolves.toMatchObject({ audioUrl: `/audio/${successfulWord}.mp3` });

    vi.clearAllMocks();

    generateLanguageAudioMock.mockImplementation(({ text }: { text: string }) =>
      Promise.resolve({ data: `/audio/${text}.mp3`, error: null }),
    );

    await expect(
      generateWordAudioUrls({
        orgSlug,
        organizationId,
        targetLanguage: "es",
        words: [successfulWord, failedWord],
      }),
    ).resolves.toStrictEqual({
      [failedWord]: `/audio/${failedWord}.mp3`,
      [successfulWord]: `/audio/${successfulWord}.mp3`,
    });

    expect(generateLanguageAudioMock).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ text: failedWord }),
    );
  });

  it("propagates persistence errors instead of treating them as optional audio failures", async () => {
    const id = randomUUID().slice(0, 8);
    const word = `persist-${id}`;
    const persistenceError = new Error("database unavailable");

    vi.spyOn(prisma.word, "upsert").mockRejectedValueOnce(persistenceError);

    await expect(
      generateWordAudioUrls({ orgSlug, organizationId, targetLanguage: "es", words: [word] }),
    ).rejects.toBe(persistenceError);
  });

  it("matches existing audio case-insensitively", async () => {
    const id = randomUUID().slice(0, 8);
    const dbWord = `Hola-${id}`;

    await wordFixture({
      audioUrl: "/audio/hola.mp3",
      organizationId,
      targetLanguage: "es",
      word: dbWord,
    });

    const result = await generateWordAudioUrls({
      orgSlug,
      organizationId,
      targetLanguage: "es",
      words: [`hola-${id}`],
    });

    expect(result[`hola-${id}`]).toBe("/audio/hola.mp3");
    expect(generateLanguageAudioMock).not.toHaveBeenCalled();
  });

  it("returns empty object for empty word list", async () => {
    const result = await generateWordAudioUrls({
      orgSlug,
      organizationId,
      targetLanguage: "es",
      words: [],
    });

    expect(result).toStrictEqual({});
    expect(generateLanguageAudioMock).not.toHaveBeenCalled();
  });
});
