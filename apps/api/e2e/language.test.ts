import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { createGuest } from "./helpers/bearer";

/** A few bytes in a supported format: enough to pass validation, never sent to a model here. */
const RECORDING = { buffer: Buffer.from([1, 2, 3]), mimeType: "audio/webm", name: "answer.webm" };

/** A guest's small AI help for a day (`assist` in core's limits). */
const GUEST_DAILY_HELP = 40;

async function createPrivateSpokenStep(ownerId: string) {
  const lesson = await libraryLessonFixture({
    language: "pt",
    ownerId,
    targetLanguage: "en",
    visibility: "private",
  });

  return libraryStepFixture({
    content: {
      language: "en",
      prompt: "Pergunte quanto é o aluguel.",
      targetText: "How much is the rent?",
    },
    kind: "spokenAnswer",
    lessonId: lesson.id,
  });
}

test.describe("Language API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication to speak an answer", async () => {
    const apiContext = await request.newContext({ baseURL });

    const spoken = await apiContext.post(`/v1/steps/${randomUUID()}/spoken-answers`, {
      multipart: { audio: RECORDING, durationMs: "1200" },
    });

    expect(spoken.status()).toBe(401);
    await apiContext.dispose();
  });

  test("validates a spoken answer before listening to it", async () => {
    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "spoken-validation",
    });

    const stepId = randomUUID();

    const [noRecording, wrongFormat, badStepId] = await Promise.all([
      apiContext.post(`/v1/steps/${stepId}/spoken-answers`, { multipart: { durationMs: "1200" } }),
      apiContext.post(`/v1/steps/${stepId}/spoken-answers`, {
        multipart: {
          audio: { ...RECORDING, mimeType: "video/mp4", name: "answer.mp4" },
          durationMs: "1200",
        },
      }),
      apiContext.post("/v1/steps/not-a-uuid/spoken-answers", {
        multipart: { audio: RECORDING, durationMs: "1200" },
      }),
    ]);

    expect(noRecording.status()).toBe(400);
    expect(badStepId.status()).toBe(400);
    expect(wrongFormat.status()).toBe(400);
    await expect(wrongFormat.json()).resolves.toMatchObject({ error: { code: "INVALID_AUDIO" } });

    await apiContext.dispose();
  });

  test("hides another learner's private speaking screen", async () => {
    const [{ apiContext }, owner] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "spoken-hidden" }),
      userFixture(),
    ]);

    const step = await createPrivateSpokenStep(owner.id);

    const response = await apiContext.post(`/v1/steps/${step.id}/spoken-answers`, {
      multipart: { audio: RECORDING, durationMs: "1200" },
    });

    expect(response.status()).toBe(404);
    await apiContext.dispose();
  });

  test("asks a guest who used today's help to sign up before listening", async () => {
    const guest = await createGuest(baseURL);

    const [step] = await Promise.all([
      createPrivateSpokenStep(guest.userId),
      usageRecordsFixture({
        count: GUEST_DAILY_HELP,
        createdAt: new Date(),
        kind: "assist",
        userId: guest.userId,
      }),
    ]);

    const response = await guest.guestApi.post(`/v1/steps/${step.id}/spoken-answers`, {
      multipart: { audio: RECORDING, durationMs: "1200" },
    });

    expect(response.status()).toBe(403);

    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "USAGE_LIMIT_REACHED",
        details: { limit: { period: "day", resource: "assist", tier: "guest" } },
      },
    });

    await guest.guestApi.dispose();
  });
});
