import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { pronunciationReviewFixture } from "@zoonk/testing/fixtures/pronunciation-reviews";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { createAuthenticatedApiContext } from "./helpers/auth";

const RECORDING = { buffer: Buffer.from([1, 2, 3]), mimeType: "audio/webm", name: "word.webm" };
const DAY_MS = 86_400_000;

/** A language learner with one word due to be said again and one waiting for tomorrow. */
async function learnerWithReviews(userId: string) {
  const [{ goal }, organization] = await Promise.all([
    languageGoalFixture({ userId }),
    aiOrganizationFixture(),
  ]);

  const [due, later] = await Promise.all([
    wordFixture({
      audioUrl: "https://audio.test/rent.mp3",
      organizationId: organization.id,
      targetLanguage: "en",
      word: `rent-${randomUUID().slice(0, 8)}`,
    }),
    wordFixture({ organizationId: organization.id, targetLanguage: "en" }),
  ]);

  await prisma.wordPronunciation.create({
    data: { pronunciation: "RÉNT", tip: "O r é suave.", userLanguage: "pt", wordId: due.id },
  });

  const [review] = await Promise.all([
    pronunciationReviewFixture({ userId, wordId: due.id }),
    pronunciationReviewFixture({ dueAt: new Date(Date.now() + DAY_MS), userId, wordId: later.id }),
  ]);

  return { due, goal, review };
}

test.describe("Pronunciation reviews API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication", async () => {
    const apiContext = await request.newContext({ baseURL });

    const responses = await Promise.all([
      apiContext.get(`/v1/goals/${randomUUID()}/pronunciation-reviews`),
      apiContext.post(`/v1/pronunciation-reviews/${randomUUID()}/answers`, {
        multipart: { audio: RECORDING, durationMs: "900", roundId: randomUUID() },
      }),
      apiContext.post(`/v1/pronunciation-rounds/${randomUUID()}/completions`, {
        data: { goalId: randomUUID() },
      }),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([401, 401, 401]);

    await apiContext.dispose();
  });

  test("lists the words due today with their sound, respelling and tip", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "pronunciation-list",
    });

    const { due, goal, review } = await learnerWithReviews(user.id);
    const other = await goalFixture({ kind: "learn", userId: user.id });

    const [list, notLanguage, today] = await Promise.all([
      apiContext.get(`/v1/goals/${goal.id}/pronunciation-reviews`),
      apiContext.get(`/v1/goals/${other.id}/pronunciation-reviews`),
      apiContext.get(`/v1/goals/${goal.id}/language-today`),
    ]);

    expect(list.status()).toBe(200);

    expect(await list.json()).toStrictEqual({
      goalId: goal.id,
      language: "en",
      words: [
        {
          audioUrl: "https://audio.test/rent.mp3",
          id: review.id,
          respelling: "RÉNT",
          romanization: null,
          tip: "O r é suave.",
          word: due.word,
        },
      ],
    });

    expect(notLanguage.status()).toBe(422);
    expect(await today.json()).toMatchObject({ pronunciation: { count: 1, words: [due.word] } });

    await apiContext.dispose();
  });

  test("rejects audio it can't grade and another learner's review", async () => {
    const [{ apiContext, user }, owner] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "pronunciation-answer" }),
      createAuthenticatedApiContext({ baseURL, prefix: "pronunciation-owner" }),
    ]);

    const [{ review }, { review: foreign }] = await Promise.all([
      learnerWithReviews(user.id),
      learnerWithReviews(owner.user.id),
    ]);

    const roundId = randomUUID();

    const [noAudio, badFormat, notMine] = await Promise.all([
      apiContext.post(`/v1/pronunciation-reviews/${review.id}/answers`, {
        multipart: { durationMs: "900", roundId },
      }),
      apiContext.post(`/v1/pronunciation-reviews/${review.id}/answers`, {
        multipart: {
          audio: { ...RECORDING, mimeType: "video/mp4", name: "word.mp4" },
          durationMs: "900",
          roundId,
        },
      }),
      apiContext.post(`/v1/pronunciation-reviews/${foreign.id}/answers`, {
        multipart: { audio: RECORDING, durationMs: "900", roundId },
      }),
    ]);

    expect(noAudio.status()).toBe(400);
    expect(badFormat.status()).toBe(400);
    expect(await badFormat.json()).toMatchObject({ error: { code: "INVALID_AUDIO" } });
    expect(notMine.status()).toBe(404);

    await Promise.all([apiContext.dispose(), owner.apiContext.dispose()]);
  });

  test("counts a round once and refuses a round with no answers", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "pronunciation-round",
    });

    const { goal, review } = await learnerWithReviews(user.id);
    const roundId = randomUUID();

    await Promise.all(
      [true, false].map((isCorrect) =>
        attemptFixture({
          answer: { kind: "spoken", pronunciationReviewId: review.id, roundId, transcript: "rent" },
          durationMs: 1500,
          isCorrect,
          targetLanguage: "en",
          userId: user.id,
        }),
      ),
    );

    const body = { goalId: goal.id, timeZone: "America/Sao_Paulo" };

    const first = await apiContext.post(`/v1/pronunciation-rounds/${roundId}/completions`, {
      data: body,
    });

    const again = await apiContext.post(`/v1/pronunciation-rounds/${roundId}/completions`, {
      data: body,
    });

    const empty = await apiContext.post(`/v1/pronunciation-rounds/${randomUUID()}/completions`, {
      data: body,
    });

    expect(first.status()).toBe(200);
    expect(await first.json()).toMatchObject({ correct: 1, total: 2 });
    expect(await again.json()).toStrictEqual(await first.json());
    expect(empty.status()).toBe(422);

    await expect(
      prisma.learningEvent.count({ where: { lessonKind: "pronunciationReview", userId: user.id } }),
    ).resolves.toBe(1);

    await apiContext.dispose();
  });
});
