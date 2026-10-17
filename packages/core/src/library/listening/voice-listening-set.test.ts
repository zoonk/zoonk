import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { voiceListeningScript } from "@zoonk/ai/tasks/audio/listening";
import { prisma } from "@zoonk/db";
import { listeningContent, listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { storeBlobUploads } from "../../_test-utils/blob-uploads";
import { getListeningAudioKey } from "./listening-audio-key";
import { listeningContentSchema } from "./listening-content";
import { voiceListeningSet } from "./voice-listening-set";

const VOICED = {
  audio: new Uint8Array([1, 2, 3]),
  durationMs: 48_000,
  format: "mp3" as const,
  provenance: {
    generatedAt: new Date().toISOString(),
    latencyMs: 9000,
    model: "google/gemini-3.8-flash-lite-tts",
    promptVersion: "test-listening-voice",
    provider: "vertex",
    requestedModel: "google/gemini-3.8-flash-lite-tts",
    runId: randomUUID(),
    usage: { audioSeconds: 48 },
  },
};

function voiceSucceeds() {
  vi.mocked(voiceListeningScript).mockResolvedValue({ data: VOICED, error: null });
}

describe(voiceListeningSet, () => {
  beforeEach(() => {
    storeBlobUploads();
  });

  it("voices a new recording once, with each speaker's voice and accent, and stores it for everyone", async () => {
    voiceSucceeds();
    const content = listeningContent();
    const set = await listeningSetFixture({ content });

    const recording = await voiceListeningSet({ serviceTier: "flex", setId: set.id });

    expect(voiceListeningScript).toHaveBeenCalledExactlyOnceWith({
      analytics: { contentScope: "shared" },
      language: "en",
      lines: content.script.turns.map((turn) => ({
        accent: turn.speaker === "Tom" ? "Australian English" : "British English",
        text: turn.text,
        voice: turn.speaker === "Tom" ? "Puck" : "Kore",
      })),
      serviceTier: "flex",
    });

    expect(put).toHaveBeenCalledExactlyOnceWith("library/listening/en.mp3", expect.any(Buffer), {
      access: "public",
      addRandomSuffix: true,
    });

    expect(recording).toMatchObject({
      durationMs: 48_000,
      kind: "audio",
      language: "en",
      mimeType: "audio/mpeg",
      model: "google/gemini-3.8-flash-lite-tts",
      reuseKey: getListeningAudioKey(listeningContentSchema.parse(content)),
      runId: VOICED.provenance.runId,
      visibility: "public",
    });

    await expect(
      prisma.itemSet.findUniqueOrThrow({ where: { id: set.id } }),
    ).resolves.toMatchObject({ mediaAssetId: recording?.id });
  });

  it("plays the stored recording the next time, without voicing it again", async () => {
    voiceSucceeds();
    const set = await listeningSetFixture();

    const first = await voiceListeningSet({ setId: set.id });
    const again = await voiceListeningSet({ setId: set.id });

    expect(again?.id).toBe(first?.id);
    expect(voiceListeningScript).toHaveBeenCalledOnce();
  });

  it("gives a set whose script another set already voiced that set's recording", async () => {
    voiceSucceeds();
    const content = listeningContent();

    const [first, twin] = await Promise.all([
      listeningSetFixture({ content }),
      listeningSetFixture({ content }),
    ]);

    const voiced = await voiceListeningSet({ setId: first.id });
    const shared = await voiceListeningSet({ setId: twin.id });

    expect(shared?.id).toBe(voiced?.id);
    expect(voiceListeningScript).toHaveBeenCalledOnce();
  });

  it("voices a recording once when two learners start it at the same time", async () => {
    voiceSucceeds();
    const set = await listeningSetFixture();

    const [first, second] = await Promise.all([
      voiceListeningSet({ setId: set.id }),
      voiceListeningSet({ setId: set.id }),
    ]);

    expect(second?.id).toBe(first?.id);
    expect(voiceListeningScript).toHaveBeenCalledOnce();
  });

  it("keeps a set unvoiced when every voice fails, so it's voiced again next time", async () => {
    vi.mocked(voiceListeningScript).mockResolvedValueOnce({
      data: null,
      error: new Error("All TTS providers failed"),
    });

    const content = listeningContent();
    const set = await listeningSetFixture({ content });

    await expect(voiceListeningSet({ setId: set.id })).resolves.toBeNull();

    await expect(
      prisma.itemSet.findUniqueOrThrow({ where: { id: set.id } }),
    ).resolves.toMatchObject({ mediaAssetId: null });

    await expect(
      prisma.mediaAsset.count({
        where: { reuseKey: getListeningAudioKey(listeningContentSchema.parse(content)) },
      }),
    ).resolves.toBe(0);
  });

  it("voices nothing for a set that isn't a recording", async () => {
    const set = await listeningSetFixture({ content: { text: "A passage" }, kind: "text" });

    await expect(voiceListeningSet({ setId: set.id })).resolves.toBeNull();
    expect(voiceListeningScript).not.toHaveBeenCalled();
  });
});
