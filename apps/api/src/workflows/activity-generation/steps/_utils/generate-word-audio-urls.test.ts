import { randomUUID } from "node:crypto";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateWordAudioUrls } from "./generate-word-audio-urls";

const { generateLanguageAudioMock } = vi.hoisted(() => ({
  generateLanguageAudioMock: vi.fn(),
}));

vi.mock("@zoonk/core/audio/generate", () => ({
  generateLanguageAudio: generateLanguageAudioMock.mockImplementation(
    ({ text }: { text: string }) => Promise.resolve({ data: `/audio/${text}.mp3`, error: null }),
  ),
}));

describe(generateWordAudioUrls, () => {
  let organizationId: number;
  let orgSlug: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    orgSlug = organization.slug;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates audio for words without existing records", async () => {
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

  test("reuses existing audio without calling TTS", async () => {
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

  test("mixes existing and generated audio", async () => {
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

  test("matches existing audio case-insensitively", async () => {
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

  test("returns empty object for empty word list", async () => {
    const result = await generateWordAudioUrls({
      orgSlug,
      organizationId,
      targetLanguage: "es",
      words: [],
    });

    expect(result).toEqual({});
    expect(generateLanguageAudioMock).not.toHaveBeenCalled();
  });
});
