import { randomUUID } from "node:crypto";
import { BlobNotFoundError, get, head, put } from "@vercel/blob";
import { joinListeningParts, voiceListeningPart } from "@zoonk/ai/tasks/audio/listening";
import { prisma } from "@zoonk/db";
import { blobStoreFixture } from "@zoonk/testing/fixtures/blobs";
import { listeningContent, listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  prepareListeningRecording,
  publishListeningRecording,
  storeListeningPart,
} from "./voice-listening-set";

const provenance = {
  generatedAt: new Date().toISOString(),
  latencyMs: 9000,
  model: "retired-speech-model",
  promptVersion: "test-version",
  provider: "vertex",
  requestedModel: "google/gemini-3.8-flash-lite-tts",
  runId: randomUUID(),
  usage: { audioSeconds: 12 },
};

async function prepare(setId: string) {
  const plan = await prepareListeningRecording(setId);

  if (plan.status !== "unvoiced") {
    throw new Error("Expected an unvoiced recording");
  }

  return plan;
}

describe("listening recording preparation", () => {
  beforeEach(() => {
    const store = blobStoreFixture(BlobNotFoundError);
    vi.mocked(head).mockImplementation(store.head);
    vi.mocked(get).mockImplementation(store.get);
    vi.mocked(put).mockImplementation(store.put);

    vi.mocked(voiceListeningPart).mockResolvedValue({
      audio: new Uint8Array([1, 2, 3]),
      provenance,
    });

    vi.mocked(joinListeningParts).mockResolvedValue({
      audio: new Uint8Array([4, 5]),
      durationMs: 48_000,
      format: "mp3",
    });
  });

  it("voices only the missing segment on a fresh run and reuses the final recording across sets", async () => {
    const content = listeningContent();
    const set = await listeningSetFixture({ content });
    const first = await prepare(set.id);

    const segments = first.parts.map((part, index) => ({ ...first, attempt: 1, index, part }));
    const final = segments.at(-1);

    if (!final) {
      throw new Error("Expected a final segment");
    }

    await Promise.all(segments.slice(0, -1).map((segment) => storeListeningPart(segment)));
    vi.mocked(voiceListeningPart).mockRejectedValueOnce(new Error("Speech unavailable"));
    await expect(storeListeningPart(final)).rejects.toThrow("Speech unavailable");

    const publication = { reuseKey: first.reuseKey, setId: set.id };
    await expect(publishListeningRecording(publication)).rejects.toThrow();
    expect(joinListeningParts).not.toHaveBeenCalled();
    vi.mocked(voiceListeningPart).mockClear();
    const second = await prepare(set.id);

    await Promise.all(
      second.parts.map((part, index) =>
        storeListeningPart({ ...second, attempt: 1, index, part, serviceTier: "flex" }),
      ),
    );

    expect(voiceListeningPart).toHaveBeenCalledExactlyOnceWith({
      analytics: { contentScope: "shared" },
      attempt: 1,
      language: "en",
      part: second.parts.at(-1),
      serviceTier: "flex",
    });

    expect(put).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ access: "public", ttlDays: 7 }),
    );

    for (const [, body] of vi.mocked(put).mock.calls) {
      if (typeof body !== "string") {
        throw new TypeError("Expected a JSON part");
      }

      const stored = JSON.parse(body) as Record<string, unknown>;

      expect(Object.keys(stored).toSorted()).toStrictEqual([
        "audio",
        "generatedAt",
        "model",
        "promptVersion",
        "runId",
      ]);
    }

    vi.mocked(put).mockRejectedValueOnce(new Error("Upload unavailable"));
    await expect(publishListeningRecording(publication)).rejects.toThrow("Upload unavailable");
    await expect(publishListeningRecording(publication)).resolves.toBe(true);

    const published = await prisma.itemSet.findUniqueOrThrow({
      include: { mediaAsset: true },
      where: { id: set.id },
    });

    expect(published.mediaAsset).toMatchObject({
      durationMs: 48_000,
      kind: "audio",
      mimeType: "audio/mpeg",
      model: provenance.model,
      runId: provenance.runId,
      visibility: "public",
    });

    const twin = await listeningSetFixture({ content });
    await expect(prepareListeningRecording(twin.id)).resolves.toStrictEqual({ status: "ready" });

    await expect(
      prisma.itemSet.findUniqueOrThrow({ where: { id: twin.id } }),
    ).resolves.toMatchObject({ mediaAssetId: published.mediaAssetId });

    await expect(publishListeningRecording(publication)).resolves.toBe(true);
    expect(joinListeningParts).toHaveBeenCalledTimes(2);
    expect(voiceListeningPart).toHaveBeenCalledOnce();
  });

  it("keeps the old recording off a set edited while the MP3 is being encoded", async () => {
    const set = await listeningSetFixture();
    const plan = await prepare(set.id);

    await Promise.all(
      plan.parts.map((part, index) => storeListeningPart({ ...plan, attempt: 1, index, part })),
    );

    vi.mocked(joinListeningParts).mockImplementationOnce(async () => {
      await prisma.itemSet.update({ data: { content: listeningContent() }, where: { id: set.id } });
      return { audio: new Uint8Array([4, 5]), durationMs: 48_000, format: "mp3" };
    });

    const publication = { reuseKey: plan.reuseKey, setId: set.id };
    await expect(publishListeningRecording(publication)).rejects.toThrow("Listening set changed");
    await expect(publishListeningRecording(publication)).resolves.toBe(false);

    await expect(
      prisma.itemSet.findUniqueOrThrow({ where: { id: set.id } }),
    ).resolves.toMatchObject({ mediaAssetId: null });
  });

  it("skips a non-recording", async () => {
    const set = await listeningSetFixture({ content: { text: "A passage" }, kind: "text" });
    await expect(prepareListeningRecording(set.id)).resolves.toStrictEqual({ status: "missing" });
    expect(voiceListeningPart).not.toHaveBeenCalled();
  });
});
