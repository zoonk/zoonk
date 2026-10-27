import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { listeningContent, listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { mockViewResponseSchema } from "../src/lib/openapi/schemas/mock-exam";
import { mockPlayResponseSchema } from "../src/lib/openapi/schemas/mock-parts";
import { anytimeMockResponseSchema } from "../src/lib/openapi/schemas/mocks";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

const PARTS = ["Part 1: a conversation", "Part 2: a talk"];
const READING_QUESTIONS = 2;

/**
 * An IELTS-like Plus learner whose full mock opens on a listening section of two voiced
 * recordings, each played once with two questions on it, then a reading section the bank holds.
 */
async function createListeningExamGoal(userId: string) {
  const unique = randomUUID();

  const [blueprint, skill, reading] = await Promise.all([
    examBlueprintFixture({
      language: "en",
      name: `IELTS ${unique}`,
      structure: {
        formats: [],
        mock: {
          adaptive: false,
          citations: [],
          order: null,
          scoring: { description: "Bands", method: "scaled" },
          sections: [
            {
              day: null,
              kind: "listening",
              minutes: 10,
              name: "Listening",
              questions: 4,
              tasks: PARTS.map((description) => ({ count: 2, description, plays: 1 })),
            },
            {
              day: null,
              kind: "objective",
              minutes: 4,
              name: "Reading",
              questions: READING_QUESTIONS,
              tasks: [],
            },
          ],
          timeLimitMinutes: null,
          totalQuestions: 4 + READING_QUESTIONS,
        },
        rules: [],
        subjects: [],
      },
    }),
    skillFixture({ name: `Note details heard ${unique}` }),
    skillFixture({ name: `Read for gist ${unique}` }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: userId, status: "active" },
    }),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetLanguage: "en",
    timezone: "UTC",
    title: "IELTS",
    userId,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Base" }],
      skills: [
        { area: "Listening", skill },
        { area: "Reading", skill: reading },
      ].map((entry) => ({
        area: entry.area,
        lessons: 1,
        name: entry.skill.name,
        phase: 0,
        skillId: entry.skill.id,
        weight: null,
      })),
    },
  });

  const recordings = await Promise.all(
    PARTS.map(async (task) => {
      const audio = await mediaAssetFixture({ durationMs: 2000, kind: "audio" });

      return listeningSetFixture({
        content: { ...listeningContent({ plays: 1 }), task },
        examBlueprintId: blueprint.id,
        mediaAssetId: audio.id,
      });
    }),
  );

  await Promise.all([
    ...recordings.flatMap((recording) =>
      [0, 1].map((setPosition) =>
        itemFixture({
          content: choiceItemContent(),
          examBlueprintId: blueprint.id,
          setId: recording.id,
          setPosition,
          skillId: skill.id,
        }),
      ),
    ),
    ...Array.from({ length: READING_QUESTIONS }, () =>
      itemFixture({
        content: choiceItemContent(),
        examBlueprintId: blueprint.id,
        skillId: reading.id,
      }),
    ),
    planItemFixture({ kind: "lesson", planId: plan.id, position: 0, skillId: reading.id }),
  ]);

  return { goal, setIds: recordings.map((recording) => recording.id) };
}

test.describe("Mock listening API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication", async () => {
    const api = await request.newContext({ baseURL });

    const response = await api.post(`/v1/mocks/${randomUUID()}/plays`, {
      data: { setId: randomUUID() },
    });

    expect(response.status()).toBe(401);
    await api.dispose();
  });

  test("counts each recording's plays on the mock, the same for any client, and none past the exam's limit", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "mock-plays" });
    const { goal, setIds } = await createListeningExamGoal(userId);
    const [first, second] = setIds;

    const started = await readBody({
      response: await api.post(`/v1/goals/${goal.id}/mocks`, {
        data: { shape: { area: null, day: null, kind: "full" } },
      }),
      schema: anytimeMockResponseSchema,
      status: 201,
    });

    const path = `/v1/mocks/${started.id}`;
    const play = (setId: string | undefined) => api.post(`${path}/plays`, { data: { setId } });

    const running = await readBody({
      response: await api.get(path),
      schema: mockViewResponseSchema,
    });

    expect(running.current?.kind).toBe("listening");

    expect(running.current?.plays.toSorted((a, b) => a.setId.localeCompare(b.setId))).toStrictEqual(
      setIds
        .map((setId) => ({ played: 0, setId }))
        .toSorted((a, b) => a.setId.localeCompare(b.setId)),
    );

    expect(
      await readBody({ response: await play(first), schema: mockPlayResponseSchema }),
    ).toStrictEqual({ played: 1 });

    // The exam plays it once: a second play, from any client, is refused.
    const again = await play(first);

    expect(again.status()).toBe(409);
    await expect(again.json()).resolves.toMatchObject({ error: { code: "MOCK_PLAYS_USED" } });

    // A recording the mock doesn't ask is never counted on it.
    const elsewhere = await play(randomUUID());

    expect(elsewhere.status()).toBe(422);

    const after = await readBody({ response: await api.get(path), schema: mockViewResponseSchema });

    expect(after.current?.plays).toContainEqual({ played: 1, setId: first });
    expect(after.current?.plays).toContainEqual({ played: 0, setId: second });

    await api.dispose();
  });
});
