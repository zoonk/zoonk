import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { memoryFactFixture, memoryInsightFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import {
  currentMemoryInsightResponseSchema,
  memoryChangeReversalSchema,
  memoryFactDeletionSchema,
  memoryFactResponseSchema,
  memoryInsightResultSchema,
  memoryResponseSchema,
  memorySettingsResponseSchema,
} from "../src/lib/openapi/schemas/memory";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

test.describe("Memory API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication for every memory resource", async () => {
    const api = await request.newContext({ baseURL });
    const id = randomUUID();

    const responses = await Promise.all([
      api.get("/v1/me/memory"),
      api.patch("/v1/me/memory", { data: { enabled: false } }),
      api.post(`/v1/me/memory/facts/${id}`, { data: { statement: "Changed" } }),
      api.delete(`/v1/me/memory/facts/${id}`),
      api.post("/v1/me/memory/change-reversals", {
        data: { changes: [{ factId: id, previousFactId: null }] },
      }),
      api.get("/v1/me/memory/export"),
      api.get("/v1/me/memory/insights/current"),
      api.patch(`/v1/me/memory/insights/${id}`, { data: { status: "accepted" } }),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual(responses.map(() => 401));
    await api.dispose();
  });

  test("lists, corrects, deletes and restores facts, and turns memory off", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "memory-manage" });

    const [law, football] = await Promise.all([
      memoryFactFixture({
        sourceRef: { id: null, kind: "onboarding" },
        statement: "Wants Law at a public university",
        userId,
      }),
      memoryFactFixture({
        category: "preferences",
        createdAt: new Date(Date.now() - 60_000),
        statement: "Likes football examples",
        userId,
      }),
    ]);

    const memory = await readBody({
      response: await api.get("/v1/me/memory"),
      schema: memoryResponseSchema,
    });

    expect(memory.enabled).toBe(true);
    expect(memory.facts.map((fact) => fact.id)).toStrictEqual([law.id, football.id]);
    expect(memory.facts[0]?.source).toStrictEqual({ id: null, kind: "onboarding" });

    const [readFact, oldCorrection] = await Promise.all([
      api.get(`/v1/me/memory/facts/${football.id}`),
      api.patch(`/v1/me/memory/facts/${football.id}`, {
        data: { statement: "A correction without a POST" },
      }),
    ]);

    expect([readFact.status(), oldCorrection.status()]).toStrictEqual([405, 405]);

    const untouched = await prisma.memoryFact.findUniqueOrThrow({ where: { id: football.id } });
    expect(untouched.statement).toBe(football.statement);

    const corrected = await readBody({
      response: await api.post(`/v1/me/memory/facts/${football.id}`, {
        data: { statement: "Likes football and futsal examples" },
      }),
      schema: memoryFactResponseSchema,
    });

    expect(corrected.fact).toMatchObject({
      id: football.id,
      origin: "said",
      statement: "Likes football and futsal examples",
    });

    const deletion = await readBody({
      response: await api.delete(`/v1/me/memory/facts/${law.id}`),
      schema: memoryFactDeletionSchema,
    });

    expect(deletion.change.previous.id).toBe(law.id);

    const afterDelete = await readBody({
      response: await api.get("/v1/me/memory"),
      schema: memoryResponseSchema,
    });

    expect(afterDelete.facts.map((fact) => fact.id)).toStrictEqual([football.id]);

    const reversal = await readBody({
      response: await api.post("/v1/me/memory/change-reversals", {
        data: { changes: [{ factId: null, previousFactId: law.id }] },
      }),
      schema: memoryChangeReversalSchema,
    });

    expect(reversal.restored.map((fact) => fact.id)).toStrictEqual([law.id]);

    const again = await api.post("/v1/me/memory/change-reversals", {
      data: { changes: [{ factId: null, previousFactId: law.id }] },
    });

    expect(again.status()).toBe(409);

    await expect(again.json()).resolves.toMatchObject({
      error: { code: "MEMORY_CHANGE_ALREADY_UNDONE" },
    });

    const settings = await readBody({
      response: await api.patch("/v1/me/memory", { data: { enabled: false } }),
      schema: memorySettingsResponseSchema,
    });

    expect(settings.enabled).toBe(false);

    const off = await readBody({
      response: await api.get("/v1/me/memory"),
      schema: memoryResponseSchema,
    });

    expect(off).toMatchObject({ enabled: false });
    expect(off.facts).toHaveLength(2);

    await api.dispose();
  });

  test("validates input, hides other learners' facts and starts with memory on", async () => {
    const [{ api, userId }, owner] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "memory-validate" }),
      userFixture(),
    ]);

    const [fact, theirs] = await Promise.all([
      memoryFactFixture({ category: "learning", userId }),
      memoryFactFixture({ userId: owner.id }),
    ]);

    const [empty, invalidId, tooMany, hidden] = await Promise.all([
      api.post(`/v1/me/memory/facts/${fact.id}`, { data: {} }),
      api.delete("/v1/me/memory/facts/not-a-uuid"),
      api.post("/v1/me/memory/change-reversals", { data: { changes: [] } }),
      api.delete(`/v1/me/memory/facts/${theirs.id}`),
    ]);

    expect([empty, invalidId, tooMany].map((response) => response.status())).toStrictEqual([
      400, 400, 400,
    ]);

    expect(hidden.status()).toBe(404);

    const memory = await readBody({
      response: await api.get("/v1/me/memory"),
      schema: memoryResponseSchema,
    });

    expect(memory).toMatchObject({ enabled: true, facts: [{ id: fact.id }] });

    await api.dispose();
  });

  test("shows the current insight and applies an accepted schedule idea once", async () => {
    const [{ api, userId }, owner] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "memory-insight" }),
      userFixture(),
    ]);

    const goal = await goalFixture({ studyTime: "07:00", userId });

    const [insight, theirs] = await Promise.all([
      memoryInsightFixture({
        goalId: goal.id,
        kind: "scheduleIdea",
        message: "You get more right after 8 pm. Want to move your study time to 8 pm?",
        payload: { studyTime: "20:00" },
        userId,
      }),
      memoryInsightFixture({ userId: owner.id }),
    ]);

    const current = await readBody({
      response: await api.get(`/v1/me/memory/insights/current?goalId=${goal.id}`),
      schema: currentMemoryInsightResponseSchema,
    });

    expect(current.insight).toMatchObject({
      id: insight.id,
      kind: "scheduleIdea",
      status: "pending",
      studyTime: "20:00",
    });

    const answered = await readBody({
      response: await api.patch(`/v1/me/memory/insights/${insight.id}`, {
        data: { status: "accepted" },
      }),
      schema: memoryInsightResultSchema,
    });

    expect(answered.insight.status).toBe("accepted");

    const updatedGoal = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(updatedGoal.studyTime).toBe("20:00");

    const [twice, hidden, invalid, noneLeft] = await Promise.all([
      api.patch(`/v1/me/memory/insights/${insight.id}`, { data: { status: "dismissed" } }),
      api.patch(`/v1/me/memory/insights/${theirs.id}`, { data: { status: "accepted" } }),
      api.patch(`/v1/me/memory/insights/${insight.id}`, { data: { status: "maybe" } }),
      api.get(`/v1/me/memory/insights/current?goalId=${goal.id}`),
    ]);

    expect(twice.status()).toBe(409);

    await expect(twice.json()).resolves.toMatchObject({
      error: { code: "MEMORY_INSIGHT_ALREADY_ANSWERED" },
    });

    expect(hidden.status()).toBe(404);
    expect(invalid.status()).toBe(400);

    await expect(noneLeft.json()).resolves.toStrictEqual({ insight: null });

    await api.dispose();
  });
});
