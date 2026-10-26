import { createHash, randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { stepExampleLineSchema } from "../src/lib/openapi/schemas/steps";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

const content = {
  exampleLineSlot: { idea: "A discount at work." },
  text: "A 25% discount takes a quarter off the price.",
};

test.describe("Personal example lines", () => {
  const baseURL = process.env.E2E_BASE_URL ?? "";

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication for reads and requests", async () => {
    const api = await request.newContext({ baseURL });
    const path = `/v1/me/example-lines/${randomUUID()}`;
    const responses = await Promise.all([api.get(path), api.post(path)]);
    expect(responses.map((response) => response.status())).toStrictEqual([401, 401]);
    await api.dispose();
  });

  test("reads only the learner's saved current example without changing memory or generating", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "example-read" });
    const lesson = await libraryLessonFixture({ contentStatus: "completed", language: "en" });

    const [step, fact, other] = await Promise.all([
      libraryStepFixture({ content, lessonId: lesson.id }),
      memoryFactFixture({ statement: "Works at a pharmacy", userId }),
      userFixture(),
    ]);

    const path = `/v1/me/example-lines/${step.id}`;

    const read = async () =>
      readBody({ response: await api.get(path), schema: stepExampleLineSchema });
    // Stored fixtures share the known context, exactly as a prior learner request would.
    const contextKey = createHash("sha256")
      .update(JSON.stringify({ goal: null, statements: [fact.statement] }))
      .digest("hex");

    await prisma.stepExampleLine.create({
      data: {
        contextKey,
        model: "test",
        promptVersion: "test",
        runId: randomUUID(),
        stepId: step.id,
        text: "Another learner's private example.",
        userId: other.id,
      },
    });

    expect(await read()).toStrictEqual({ canRequest: true, line: null, stepId: step.id });
    await expect(prisma.stepExampleLine.count({ where: { userId } })).resolves.toBe(0);

    await prisma.stepExampleLine.create({
      data: {
        contextKey,
        model: "test",
        promptVersion: "test",
        runId: randomUUID(),
        stepId: step.id,
        text: "Your R$ 40 kit costs R$ 30 after a 25% discount.",
        userId,
      },
    });

    expect(await read()).toStrictEqual({
      canRequest: false,
      line: "Your R$ 40 kit costs R$ 30 after a 25% discount.",
      stepId: step.id,
    });

    await expect(
      prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } }),
    ).resolves.toMatchObject({ lastUsedAt: null });

    await prisma.memoryFact.update({
      data: { statement: "Works at a bakery" },
      where: { id: fact.id },
    });

    expect(await read()).toStrictEqual({ canRequest: true, line: null, stepId: step.id });
    await api.dispose();
  });
});
