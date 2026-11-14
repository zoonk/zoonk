import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { prisma } from "@zoonk/db";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { describe, expect, it, vi } from "vitest";
import { storeBlobUploads } from "../../_test-utils/blob-uploads";
import { voiceWord } from "./voice-word";

describe(voiceWord, () => {
  it("leaves a word without the clip voiced for text it no longer has", async () => {
    const organization = await organizationFixture();
    const word = await wordFixture({ organizationId: organization.id, targetLanguage: "en" });
    storeBlobUploads();

    vi.mocked(generateLanguageAudio).mockImplementation(async () => {
      await prisma.word.update({ data: { word: "rental" }, where: { id: word.id } });

      return {
        data: {
          audio: new Uint8Array([1]),
          durationMs: 900,
          format: "mp3",
          provenance: {
            generatedAt: new Date().toISOString(),
            latencyMs: 1,
            model: "openai/gpt-voice",
            promptVersion: "test",
            provider: "openai",
            requestedModel: "openai/gpt-voice",
            runId: "speech-run",
            usage: {},
          },
        },
        error: null,
      };
    });

    await voiceWord({ orgSlug: organization.slug, targetLanguage: "en", wordId: word.id });

    await expect(prisma.word.findUniqueOrThrow({ where: { id: word.id } })).resolves.toMatchObject({
      audioUrl: null,
      word: "rental",
    });
  });
});
