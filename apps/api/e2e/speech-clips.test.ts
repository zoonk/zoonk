import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { getSpeechClipKey } from "@zoonk/core/audio/speech-clip-key";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { createGuest } from "./helpers/bearer";

const GUEST_DAILY_HELP = 40;

/** Words no other test asks for, so each test owns its clip. */
function uniqueSentence() {
  return `Ciao, questa è la frase ${randomUUID().slice(0, 8)}.`;
}

/** A clip someone already heard: stored under the key the API looks it up by. */
function storedClip({ language, text }: { language: string; text: string }) {
  return mediaAssetFixture({
    durationMs: 1900,
    kind: "audio",
    language,
    reuseKey: getSpeechClipKey({ language, text }),
    url: `https://audio.test/${randomUUID()}.mp3`,
  });
}

function assistClaims(userId: string) {
  return prisma.usageRecord.count({ where: { kind: "assist", userId } });
}

test.describe("Speech clips API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication", async () => {
    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/speech-clips", {
      data: { language: "it", text: "Ciao" },
    });

    expect(response.status()).toBe(401);
    await apiContext.dispose();
  });

  test("plays a clip someone already heard without counting it as help", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "speech-stored",
    });

    const text = uniqueSentence();
    const clip = await storedClip({ language: "it", text });

    const response = await apiContext.post("/v1/speech-clips", {
      data: { language: "it", text: `  ${text}  ` },
    });

    expect(response.status()).toBe(200);

    await expect(response.json()).resolves.toStrictEqual({
      durationMs: 1900,
      id: clip.id,
      language: "it",
      url: clip.url,
    });

    await expect(assistClaims(user.id)).resolves.toBe(0);
    await apiContext.dispose();
  });

  test("refuses a language without a voice, empty text and text too long for one clip", async () => {
    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "speech-invalid",
    });

    const responses = await Promise.all([
      apiContext.post("/v1/speech-clips", { data: { language: "xx", text: "Ciao" } }),
      apiContext.post("/v1/speech-clips", { data: { language: "it", text: "   " } }),
      apiContext.post("/v1/speech-clips", { data: { language: "it", text: "a".repeat(601) } }),
      apiContext.post("/v1/speech-clips", { data: { text: "Ciao" } }),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([400, 400, 400, 400]);

    await expect(responses[0]?.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });

    await apiContext.dispose();
  });

  test("slows down a learner asking for too many new clips", async () => {
    const { apiContext } = await createAuthenticatedApiContext({ baseURL, prefix: "speech-slow" });

    const response = await apiContext.post("/v1/speech-clips", {
      data: { language: "it", text: uniqueSentence() },
      headers: { "x-e2e-rate-limited": "ai-usage" },
    });

    expect(response.status()).toBe(429);
    expect(response.headers()["retry-after"]).toBe("60");

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "SLOW_DOWN", details: { retryAfterSeconds: 60 } },
    });

    await apiContext.dispose();
  });

  test("asks a guest who used today's help to sign up for a new clip, but still plays stored ones", async () => {
    const guest = await createGuest(baseURL);
    const stored = uniqueSentence();

    const [clip] = await Promise.all([
      storedClip({ language: "es", text: stored }),
      usageRecordsFixture({
        count: GUEST_DAILY_HELP,
        createdAt: new Date(),
        kind: "assist",
        userId: guest.userId,
      }),
    ]);

    const [fresh, heard] = await Promise.all([
      guest.guestApi.post("/v1/speech-clips", { data: { language: "es", text: uniqueSentence() } }),
      guest.guestApi.post("/v1/speech-clips", { data: { language: "es", text: stored } }),
    ]);

    expect(fresh.status()).toBe(403);

    await expect(fresh.json()).resolves.toMatchObject({
      error: { code: "USAGE_LIMIT_REACHED", details: { limit: { tier: "guest" } } },
    });

    expect(heard.status()).toBe(200);
    await expect(heard.json()).resolves.toMatchObject({ id: clip.id, url: clip.url });

    await guest.guestApi.dispose();
  });

  test("says no voice could read a new clip when text-to-speech fails, and stores nothing", async () => {
    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "speech-unavailable",
    });

    // Model calls fail during E2E runs before they leave the server, as an outage would.
    const text = uniqueSentence();

    const response = await apiContext.post("/v1/speech-clips", { data: { language: "it", text } });

    expect(response.status()).toBe(503);

    await expect(response.json()).resolves.toMatchObject({ error: { code: "SPEECH_UNAVAILABLE" } });

    await expect(
      prisma.mediaAsset.count({ where: { reuseKey: getSpeechClipKey({ language: "it", text }) } }),
    ).resolves.toBe(0);

    await apiContext.dispose();
  });
});
