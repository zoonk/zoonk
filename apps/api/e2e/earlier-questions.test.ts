import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { earlierQuestionsResponseSchema } from "../src/lib/openapi/schemas/lesson-questions";
import { createBearerLearner } from "./helpers/bearer";

async function earlierQuestion({ question, userId }: { question: string; userId: string }) {
  const thread = await prisma.lessonQuestionThread.create({ data: { kind: "lesson", userId } });

  return prisma.lessonQuestion.create({
    data: {
      answer: "Because forces come in pairs.",
      contextKind: "lesson",
      contextSnapshot: { course: { title: "Physics" }, lesson: { title: "Newton's laws" } },
      question,
      requestFingerprint: randomUUID(),
      requestId: randomUUID(),
      status: "completed",
      threadId: thread.id,
    },
  });
}

test.describe("Earlier questions API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("lists the learner's own questions from an earlier version of their courses", async () => {
    const [{ api, userId }, stranger] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "earlier-questions" }),
      userFixture(),
    ]);

    const [mine] = await Promise.all([
      earlierQuestion({ question: "Why does the cart move back?", userId }),
      earlierQuestion({ question: "Someone else's question", userId: stranger.id }),
    ]);

    const response = await api.get("/v1/me/earlier-questions");
    expect(response.status(), await response.text()).toBe(200);

    expect(earlierQuestionsResponseSchema.parse(await response.json())).toStrictEqual({
      nextCursor: null,
      questions: [
        {
          answer: "Because forces come in pairs.",
          askedAt: mine.createdAt.toISOString(),
          courseTitle: "Physics",
          id: mine.id,
          lessonTitle: "Newton's laws",
          question: "Why does the cart move back?",
        },
      ],
    });

    const badCursor = await api.get(`/v1/me/earlier-questions?cursor=${randomUUID()}`);
    expect(badCursor.status()).toBe(400);

    await api.dispose();
  });

  test("needs a session", async () => {
    const anonymous = await request.newContext({ baseURL });
    const response = await anonymous.get("/v1/me/earlier-questions");
    expect(response.status()).toBe(401);
    await anonymous.dispose();
  });
});
