import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { prisma } from "@zoonk/db";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { GUEST_OUT_OF_HELP, useGuestOutOfHelp } from "../_test-utils/guest-out-of-help";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { requestSpeechClip } from "./request-speech-clip";
import { getSpeechClipKey } from "./speech-clip-key";
import type * as AudioTask from "@zoonk/ai/tasks/audio";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

vi.mock("@zoonk/ai/tasks/audio", async (importOriginal) => ({
  ...(await importOriginal<typeof AudioTask>()),
  generateLanguageAudio: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (pathname: string) => ({
    url: `https://blob.test/${randomUUID()}-${pathname}`,
  })),
}));

const VOICED = {
  audio: new Uint8Array([1, 2, 3]),
  durationMs: 2400,
  format: "mp3" as const,
  provenance: {
    generatedAt: new Date().toISOString(),
    latencyMs: 900,
    model: "google/gemini-3.8-flash-tts",
    promptVersion: "test-voice",
    provider: "vertex",
    requestedModel: "google/gemini-3.8-flash-tts",
    runId: randomUUID(),
    usage: { audioSeconds: 2.4 },
  },
};

/** A sentence no other test asks for, so each test owns its clip. */
function uniqueSentence() {
  return `Questa è la frase numero ${randomUUID()}.`;
}

function voiceSucceeds() {
  vi.mocked(generateLanguageAudio).mockResolvedValue({ data: VOICED, error: null });
}

async function signIn() {
  const learner = await userFixture();
  mockSession(learner.id);
  return learner;
}

function assistClaims(userId: string) {
  return prisma.usageRecord.count({ where: { kind: "assist", userId } });
}

describe(requestSpeechClip, () => {
  it("requires a session", async () => {
    mockSession(null);

    await expect(requestSpeechClip({ language: "it", text: "Ciao" })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("refuses a language without a voice and empty text, before any model call", async () => {
    await signIn();

    await expect(requestSpeechClip({ language: "xx", text: "Ciao" })).resolves.toStrictEqual({
      status: "invalid",
    });

    await expect(requestSpeechClip({ language: "it", text: "   " })).resolves.toStrictEqual({
      status: "invalid",
    });

    expect(generateLanguageAudio).not.toHaveBeenCalled();
  });

  it("plays a stored clip for a guest without a model call or a claim", async () => {
    const guest = await userFixture();
    const text = uniqueSentence();

    const stored = await mediaAssetFixture({
      durationMs: 1800,
      kind: "audio",
      language: "it",
      reuseKey: getSpeechClipKey({ language: "it", text }),
      url: "https://blob.test/stored.mp3",
    });

    mockGuestSession(guest.id);

    await expect(
      requestSpeechClip({ language: "it", text: `  ${text.replace(" è ", "   è ")}` }),
    ).resolves.toStrictEqual({
      clip: {
        durationMs: 1800,
        id: stored.id,
        language: "it",
        url: "https://blob.test/stored.mp3",
      },
      status: "ready",
    });

    expect(generateLanguageAudio).not.toHaveBeenCalled();
    await expect(assistClaims(guest.id)).resolves.toBe(0);
  });

  it("voices a new clip once, in its language, and shares it after that", async () => {
    const learner = await signIn();
    const text = uniqueSentence();
    voiceSucceeds();

    const first = await requestSpeechClip({ language: "it", text });
    const again = await requestSpeechClip({ language: "it", text });

    expect(first).toStrictEqual({
      clip: { durationMs: 2400, id: expect.any(String), language: "it", url: expect.any(String) },
      status: "ready",
    });

    expect(again).toStrictEqual(first);

    expect(generateLanguageAudio).toHaveBeenCalledExactlyOnceWith({
      analytics: { contentScope: "shared", distinctId: learner.id },
      language: "it",
      text,
    });

    expect(put).toHaveBeenCalledExactlyOnceWith("library/audio/it.mp3", expect.any(Buffer), {
      access: "public",
      addRandomSuffix: true,
    });

    await expect(
      prisma.mediaAsset.findUniqueOrThrow({
        where: { reuseKey: getSpeechClipKey({ language: "it", text }) },
      }),
    ).resolves.toMatchObject({
      durationMs: 2400,
      kind: "audio",
      language: "it",
      mimeType: "audio/mpeg",
      model: "google/gemini-3.8-flash-tts",
      prompt: text,
      promptVersion: "test-voice",
      runId: VOICED.provenance.runId,
      visibility: "public",
    });

    await expect(assistClaims(learner.id)).resolves.toBe(1);
  });

  // A call's better version of what the learner said is their own sentence: their data.
  it("keeps a learner's own words in a private clip of theirs alone", async () => {
    vi.stubEnv("PRIVATE_BLOB_READ_WRITE_TOKEN", "private-store-token");
    const learner = await signIn();
    const text = uniqueSentence();
    voiceSucceeds();

    const own = await requestSpeechClip({ language: "it", personal: true, text });

    expect(own.status).toBe("ready");

    expect(put).toHaveBeenCalledExactlyOnceWith(`audio/${learner.id}/it.mp3`, expect.any(Buffer), {
      access: "private",
      addRandomSuffix: true,
      storeId: undefined,
      token: "private-store-token",
    });

    await expect(
      prisma.mediaAsset.findUniqueOrThrow({
        where: { reuseKey: getSpeechClipKey({ language: "it", ownerId: learner.id, text }) },
      }),
    ).resolves.toMatchObject({ ownerId: learner.id, prompt: text, visibility: "private" });

    expect(generateLanguageAudio).toHaveBeenCalledWith(
      expect.objectContaining({ analytics: { contentScope: "personal", distinctId: learner.id } }),
    );

    // Nobody else gets it: the same words as shared words, or as another learner's own, are
    // voiced apart.
    const shared = await requestSpeechClip({ language: "it", text });
    const other = await signIn();
    const theirs = await requestSpeechClip({ language: "it", personal: true, text });

    expect(shared).not.toStrictEqual(own);
    expect(theirs).not.toStrictEqual(own);

    expect(put).toHaveBeenLastCalledWith(`audio/${other.id}/it.mp3`, expect.any(Buffer), {
      access: "private",
      addRandomSuffix: true,
      storeId: undefined,
      token: "private-store-token",
    });

    vi.unstubAllEnvs();
  });

  it("never stores a learner's own words in the public store when the private one is missing", async () => {
    vi.stubEnv("PRIVATE_BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("PRIVATE_BLOB_STORE_ID", "");
    const learner = await signIn();
    const text = uniqueSentence();
    voiceSucceeds();

    await expect(
      requestSpeechClip({ language: "it", personal: true, text }),
    ).resolves.toStrictEqual({ status: "failed" });

    expect(put).not.toHaveBeenCalled();

    await expect(
      prisma.mediaAsset.count({
        where: { reuseKey: getSpeechClipKey({ language: "it", ownerId: learner.id, text }) },
      }),
    ).resolves.toBe(0);

    vi.unstubAllEnvs();
  });

  it("keeps a clip apart for each language", async () => {
    await signIn();
    voiceSucceeds();

    const text = `No sé ${randomUUID()}.`;

    const [spanish, portuguese] = await Promise.all([
      requestSpeechClip({ language: "es", text }),
      requestSpeechClip({ language: "pt", text }),
    ]);

    expect(spanish.status).toBe("ready");
    expect(portuguese.status).toBe("ready");
    expect(spanish).not.toStrictEqual(portuguese);
  });

  it("ends concurrent requests for the same new words with one clip and one model call", async () => {
    await signIn();
    const text = uniqueSentence();
    voiceSucceeds();

    const results = await Promise.all([
      requestSpeechClip({ language: "it", text }),
      requestSpeechClip({ language: "it", text }),
    ]);

    expect(results[0]).toStrictEqual(results[1]);
    expect(generateLanguageAudio).toHaveBeenCalledOnce();

    await expect(
      prisma.mediaAsset.count({ where: { reuseKey: getSpeechClipKey({ language: "it", text }) } }),
    ).resolves.toBe(1);
  });

  it("returns the clip another server saved first instead of a second copy", async () => {
    await signIn();
    const text = uniqueSentence();
    const reuseKey = getSpeechClipKey({ language: "it", text });

    // Another server finishes the same clip while this one is still voicing it.
    vi.mocked(generateLanguageAudio).mockImplementationOnce(async () => {
      await mediaAssetFixture({
        kind: "audio",
        language: "it",
        reuseKey,
        url: "https://blob.test/winner.mp3",
      });

      return { data: VOICED, error: null };
    });

    await expect(requestSpeechClip({ language: "it", text })).resolves.toMatchObject({
      clip: { url: "https://blob.test/winner.mp3" },
      status: "ready",
    });

    await expect(prisma.mediaAsset.count({ where: { reuseKey } })).resolves.toBe(1);
  });

  it("asks a guest who used today's help to sign up before voicing a new clip", async () => {
    await useGuestOutOfHelp();

    await expect(
      requestSpeechClip({ language: "it", text: uniqueSentence() }),
    ).resolves.toStrictEqual(GUEST_OUT_OF_HELP);

    expect(generateLanguageAudio).not.toHaveBeenCalled();
  });

  it("stores nothing when every voice fails", async () => {
    await signIn();
    const text = uniqueSentence();

    vi.mocked(generateLanguageAudio).mockResolvedValueOnce({
      data: null,
      error: new Error("All TTS providers failed"),
    });

    await expect(requestSpeechClip({ language: "it", text })).resolves.toStrictEqual({
      status: "failed",
    });

    await expect(
      prisma.mediaAsset.count({ where: { reuseKey: getSpeechClipKey({ language: "it", text }) } }),
    ).resolves.toBe(0);
  });
});
