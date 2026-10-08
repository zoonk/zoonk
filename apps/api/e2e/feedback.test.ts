import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { createAuthenticatedApiContext } from "./helpers/auth";

/** A public Library lesson, with the workflow run that wrote it. */
function createLesson() {
  return libraryLessonFixture({ runId: `run-${randomUUID()}` });
}

test.describe("Feedback API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("accepts a feedback message", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/feedback", {
      data: {
        email: `e2e-feedback-${uniqueId}@zoonk.test`,
        message: `Native client feedback message ${uniqueId}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.message).toBe("Feedback received");

    await expect(
      prisma.feedback.findFirst({
        where: { message: `Native client feedback message ${uniqueId}` },
      }),
    ).resolves.toMatchObject({ context: {}, status: "new", userId: null });

    await apiContext.dispose();
  });

  test("stores the context and the signed-in learner with a message", async () => {
    const { apiContext, uniqueId, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "feedback-context",
    });

    const contentId = randomUUID();
    const message = `Signed-in feedback ${uniqueId}`;

    const response = await apiContext.post("/v1/feedback", {
      data: {
        context: {
          appVersion: "3.2.0",
          contentId,
          contentKind: "lesson",
          platform: "ios",
          screen: "lesson-completion",
        },
        email: `e2e-feedback-${uniqueId}@zoonk.test`,
        message,
      },
    });

    expect(response.status()).toBe(200);

    await expect(prisma.feedback.findFirst({ where: { message } })).resolves.toMatchObject({
      context: {
        appVersion: "3.2.0",
        contentId,
        contentKind: "lesson",
        platform: "ios",
        screen: "lesson-completion",
      },
      userId: user.id,
    });

    await apiContext.dispose();
  });

  test("returns validation error for missing message", async () => {
    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/feedback", {
      data: { email: "e2e-feedback-invalid@zoonk.test" },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });
});

test.describe("Content votes API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("requires authentication", async () => {
    const apiContext = await request.newContext({ baseURL });

    const path = `/v1/me/content-votes/lesson/${randomUUID()}`;

    const [response, read] = await Promise.all([
      apiContext.put(path, { data: { vote: "up" } }),
      apiContext.get(path),
    ]);

    expect(response.status()).toBe(401);
    expect(read.status()).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });

    await apiContext.dispose();
  });

  test("stores one vote per learner and content, replacing it on a new vote", async () => {
    const [{ apiContext, user }, lesson] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "content-vote" }),
      createLesson(),
    ]);

    const path = `/v1/me/content-votes/lesson/${lesson.id}`;

    const beforeVoting = await apiContext.get(path);
    expect(beforeVoting.status()).toBe(404);

    const downvote = await apiContext.put(path, {
      data: {
        comment: "The example skips a step",
        language: "en",
        reasons: ["hardToFollow", "tooHard"],
        vote: "down",
      },
    });

    expect(downvote.status()).toBe(200);

    const storedDownvote = {
      comment: "The example skips a step",
      contentId: lesson.id,
      contentKind: "lesson",
      reasons: ["hardToFollow", "tooHard"],
      updatedAt: expect.any(String),
      vote: "down",
    };

    await expect(downvote.json()).resolves.toStrictEqual(storedDownvote);

    const readBack = await apiContext.get(path);
    expect(readBack.status()).toBe(200);
    await expect(readBack.json()).resolves.toStrictEqual(storedDownvote);

    const upvote = await apiContext.put(path, { data: { vote: "up" } });

    expect(upvote.status()).toBe(200);
    await expect(upvote.json()).resolves.toMatchObject({ comment: null, reasons: [], vote: "up" });

    await expect(
      prisma.contentFeedback.findMany({ where: { contentId: lesson.id, userId: user.id } }),
    ).resolves.toStrictEqual([
      expect.objectContaining({
        contentKind: "lesson",
        language: null,
        model: lesson.model,
        promptVersion: lesson.promptVersion,
        reasons: [],
        runId: lesson.runId,
        vote: "up",
      }),
    ]);

    await apiContext.dispose();
  });

  test("rejects invalid votes and content the learner can't vote on", async () => {
    const [{ apiContext }, lesson] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "content-vote-invalid" }),
      createLesson(),
    ]);

    const [reasonsOnUpvote, unknownKind, unknownContent] = await Promise.all([
      apiContext.put(`/v1/me/content-votes/lesson/${lesson.id}`, {
        data: { reasons: ["tooEasy"], vote: "up" },
      }),
      apiContext.put(`/v1/me/content-votes/podcast/${lesson.id}`, { data: { vote: "up" } }),
      apiContext.put(`/v1/me/content-votes/lesson/${randomUUID()}`, { data: { vote: "up" } }),
    ]);

    expect(reasonsOnUpvote.status()).toBe(400);
    expect(unknownKind.status()).toBe(400);
    expect(unknownContent.status()).toBe(404);

    await expect(prisma.contentFeedback.count({ where: { contentId: lesson.id } })).resolves.toBe(
      0,
    );

    await apiContext.dispose();
  });
});
