import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { GUEST_OUT_OF_HELP, useGuestOutOfHelp } from "../_test-utils/guest-out-of-help";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { requestSpeechClip } from "./request-speech-clip";
import { getSpeechClipKey } from "./speech-clip-key";
import type * as AudioTask from "@zoonk/ai/tasks/audio";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The firewall, the text-to-speech model and the file store are external boundaries. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(async () => false),
}));

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
    expect(isRateLimited).not.toHaveBeenCalled();
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
      analytics: { distinctId: learner.id },
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

  it("slows down a learner who asks for too many new clips, before voicing", async () => {
    await signIn();
    vi.mocked(isRateLimited).mockResolvedValueOnce(true);

    await expect(
      requestSpeechClip({ language: "it", text: uniqueSentence() }),
    ).resolves.toStrictEqual({ retryAfterSeconds: 60, status: "slowDown" });

    expect(generateLanguageAudio).not.toHaveBeenCalled();
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
