import { randomUUID } from "node:crypto";
import { type APIRequestContext, request } from "@playwright/test";
import { type StepKind } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { playableLibraryLessonResponseSchema } from "../src/lib/openapi/schemas/library-lessons";
import { stepExampleLineSchema, stepVariantSchema } from "../src/lib/openapi/schemas/step-variants";
import { createBearerLearner, createGuest } from "./helpers/bearer";
import { readBody } from "./helpers/response";

const explanation = {
  exampleLineSlot: { idea: "A discount on something the learner buys." },
  text: "A 25% discount takes a quarter off the price.",
  title: "Discounts",
};

const simpler = { text: "25% off means you pay 3 of every 4 dollars.", title: "A quarter off" };

/** A guest's small AI help for a day (`assist` in core's limits). */
const GUEST_DAILY_HELP = 40;

/** A screen of a published Library lesson. */
async function createScreen({
  content = explanation,
  kind = "explanation",
}: { content?: object; kind?: StepKind } = {}) {
  const lesson = await libraryLessonFixture({ contentStatus: "completed" });
  return libraryStepFixture({ content, kind, lessonId: lesson.id });
}

test.describe("Step variants API", () => {
  let baseURL: string;
  let api: APIRequestContext;

  test.beforeAll(async () => {
    baseURL = process.env.E2E_BASE_URL ?? "";
    ({ api } = await createBearerLearner({ baseURL, prefix: "step-variants" }));
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test("returns the shared simpler version of a screen", async () => {
    const step = await createScreen();

    const variant = await stepVariantFixture({
      content: simpler,
      kind: "simpler",
      stepId: step.id,
    });

    const response = await api.post(`/v1/steps/${step.id}/variants`, { data: { kind: "simpler" } });

    expect(response.status()).toBe(200);

    expect(stepVariantSchema.parse(await response.json())).toStrictEqual({
      content: simpler,
      id: variant.id,
      kind: "simpler",
      stepId: step.id,
    });
  });

  test("serves a version written after the lesson was read with the next read of the lesson", async () => {
    const { lesson, steps } = await playableLessonFixture({ steps: ["explanation", "check"] });
    const lessonPath = `/v1/library/lessons/${lesson.id}`;

    const before = await readBody({
      response: await api.get(lessonPath),
      schema: playableLibraryLessonResponseSchema,
    });

    expect(before.status === "ready" && before.lesson.steps[0]).toMatchObject({
      variants: { simpler: null },
    });

    // Main writes versions too, and its cache never tells this app's cached lesson about them.
    const variant = await stepVariantFixture({
      content: simpler,
      kind: "simpler",
      stepId: steps[0]!.id,
    });

    const after = await readBody({
      response: await api.get(lessonPath),
      schema: playableLibraryLessonResponseSchema,
    });

    expect(after.status === "ready" && after.lesson.steps[0]).toMatchObject({
      variants: { simpler: { content: simpler, id: variant.id } },
    });
  });

  test("asks visitors to sign in", async () => {
    const step = await createScreen();
    const visitor = await request.newContext({ baseURL });

    const response = await visitor.post(`/v1/steps/${step.id}/variants`, {
      data: { kind: "deeper" },
    });

    expect(response.status()).toBe(401);
    await visitor.dispose();
  });

  test("rejects kinds learners can't ask for and unknown screens", async () => {
    const step = await createScreen();

    const [fieldVersion, badId, unknown] = await Promise.all([
      api.post(`/v1/steps/${step.id}/variants`, { data: { kind: "field" } }),
      api.post("/v1/steps/not-a-step/variants", { data: { kind: "simpler" } }),
      api.post(`/v1/steps/${randomUUID()}/variants`, { data: { kind: "simpler" } }),
    ]);

    expect(fieldVersion.status()).toBe(400);
    expect(badId.status()).toBe(400);
    expect(unknown.status()).toBe(404);
  });

  test("explains that checks have no simpler version", async () => {
    const step = await createScreen({
      content: {
        options: [
          { id: "a", isCorrect: true, reason: "A quarter of 40 is 10.", text: "$30" },
          { id: "b", isCorrect: false, reason: "That's the discount itself.", text: "$10" },
        ],
        question: "A $40 shirt is 25% off. What do you pay?",
      },
      kind: "check",
    });

    const response = await api.post(`/v1/steps/${step.id}/variants`, { data: { kind: "simpler" } });

    expect(response.status()).toBe(422);
  });

  test("has no example line for a learner who shared nothing", async () => {
    const step = await createScreen();

    const response = await api.post(`/v1/me/example-lines/${step.id}`);

    expect(response.status()).toBe(200);

    expect(stepExampleLineSchema.parse(await response.json())).toStrictEqual({
      line: null,
      stepId: step.id,
    });
  });

  test("keeps example lines to signed-in learners and real screens", async () => {
    const step = await createScreen();
    const visitor = await request.newContext({ baseURL });

    const [anonymous, unknown] = await Promise.all([
      visitor.post(`/v1/me/example-lines/${step.id}`),
      api.post(`/v1/me/example-lines/${randomUUID()}`),
    ]);

    expect(anonymous.status()).toBe(401);
    expect(unknown.status()).toBe(404);
    await visitor.dispose();
  });

  test("never writes an example line on a GET, so a crawler or prefetch can't start AI work", async () => {
    const step = await createScreen();
    const response = await api.get(`/v1/me/example-lines/${step.id}`);

    expect(response.status()).toBe(405);
  });

  test("asks a guest who used today's help to sign up before writing a new version", async () => {
    const [step, guest] = await Promise.all([createScreen(), createGuest(baseURL)]);

    await usageRecordsFixture({
      count: GUEST_DAILY_HELP,
      createdAt: new Date(),
      kind: "assist",
      userId: guest.userId,
    });

    const response = await guest.guestApi.post(`/v1/steps/${step.id}/variants`, {
      data: { kind: "simpler" },
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
