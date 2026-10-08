import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  heldBackDraftFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import {
  goalGenerationSchema,
  lessonGenerationSchema,
  lessonReadinessSchema,
  sessionPreparationSchema,
} from "../src/lib/openapi/schemas/content-generation";
import { generationResourceSchema } from "../src/lib/openapi/schemas/workflows";
import { createBearerLearner, createGuest } from "./helpers/bearer";
import { readBody } from "./helpers/response";

test.describe("Content generation API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("requires a session for every content generation endpoint", async () => {
    const anonymous = await request.newContext({ baseURL });
    const lessonId = randomUUID();

    const responses = await Promise.all([
      anonymous.post(`/v1/library/lessons/${lessonId}/generations`),
      anonymous.get(`/v1/library/lessons/${lessonId}/readiness`),
      anonymous.post(`/v1/study-sessions/${randomUUID()}/preparations`),
      anonymous.post(`/v1/goals/${randomUUID()}/lesson-preparations`),
      anonymous.post("/v1/me/generation-waits", {
        data: { contentKind: "lesson", milliseconds: 1200 },
      }),
      anonymous.post(`/v1/goals/${randomUUID()}/generations`),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([
      401, 401, 401, 401, 401, 401,
    ]);

    await anonymous.dispose();
  });

  test("answers ready for a written lesson and replaces a run that stopped writing one", async () => {
    const { api } = await createBearerLearner({ baseURL, prefix: "content-generation" });
    const stoppedRunId = `wrun_${randomUUID()}`;

    const [written, abandoned] = await Promise.all([
      libraryLessonFixture({ contentStatus: "completed" }),
      libraryLessonFixture({ contentRunId: stoppedRunId, contentStatus: "running" }),
    ]);

    await expect(
      readBody({
        response: await api.post(`/v1/library/lessons/${written.id}/generations`),
        schema: lessonGenerationSchema,
      }),
    ).resolves.toStrictEqual({ generationId: null, status: "ready" });

    // Its claim names a run that no longer exists: following it would wait forever.
    const replaced = await readBody({
      response: await api.post(`/v1/library/lessons/${abandoned.id}/generations`),
      schema: lessonGenerationSchema,
      status: 202,
    });

    expect(replaced.status).toBe("generating");
    expect(replaced.generationId).not.toBe(stoppedRunId);

    const missing = await api.post(`/v1/library/lessons/${randomUUID()}/generations`);
    expect(missing.status()).toBe(404);

    await api.dispose();
  });

  test("answers 409 for a lesson set aside after its last held-back draft", async () => {
    const { api } = await createBearerLearner({ baseURL, prefix: "content-set-aside" });

    const setAside = await libraryLessonFixture({
      contentStatus: "failed",
      heldBackDrafts: [heldBackDraftFixture(), heldBackDraftFixture(), heldBackDraftFixture()],
      setAsideAt: new Date(),
    });

    const response = await api.post(`/v1/library/lessons/${setAside.id}/generations`);

    expect(response.status()).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "LESSON_SET_ASIDE" } });

    await api.dispose();
  });

  test("tells the lesson page which run writes a lesson and what is ready instead", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "content-readiness" });
    const goal = await goalFixture({ userId });
    const runId = `wrun_${randomUUID()}`;

    const [plan, waiting, ready] = await Promise.all([
      planFixture({ goalId: goal.id }),
      libraryLessonFixture({ contentRunId: runId, contentStatus: "running" }),
      libraryLessonFixture({ contentStatus: "completed", title: "A lesson ready now" }),
      prisma.userLearningProfile.upsert({
        create: { activeGoalId: goal.id, userId },
        update: { activeGoalId: goal.id },
        where: { userId },
      }),
    ]);

    await planItemFixture({ lessonId: waiting.id, planId: plan.id, position: 0 });
    await planItemFixture({ lessonId: ready.id, planId: plan.id, position: 1 });

    const readiness = await readBody({
      response: await api.get(`/v1/library/lessons/${waiting.id}/readiness`),
      schema: lessonReadinessSchema,
    });

    expect(readiness).toStrictEqual({
      alternative: { kind: "lesson", lessonId: ready.id, title: "A lesson ready now" },
      generationId: runId,
      status: "generating",
    });

    await api.dispose();
  });

  test("prepares a learner's session, before or after it ended, and hides other learners' sessions", async () => {
    const [{ api, userId }, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "session-preparation" }),
      createBearerLearner({ baseURL, prefix: "session-preparation-other" }),
    ]);

    const goal = await goalFixture({ userId });

    const [running, ended] = await Promise.all([
      studySessionFixture({ goalId: goal.id, userId }),
      studySessionFixture({
        goalId: goal.id,
        localDate: new Date("2026-01-01T00:00:00.000Z"),
        status: "completed",
        userId,
      }),
    ]);

    const [started, afterEnd] = await Promise.all(
      [running, ended].map(async (session) =>
        readBody({
          response: await api.post(`/v1/study-sessions/${session.id}/preparations`),
          schema: sessionPreparationSchema,
          status: 202,
        }),
      ),
    );

    expect(started).toStrictEqual({ preparationId: expect.any(String) });
    expect(afterEnd).toStrictEqual({ preparationId: expect.any(String) });

    const hidden = await other.api.post(`/v1/study-sessions/${running.id}/preparations`);
    expect(hidden.status()).toBe(404);

    await Promise.all([api.dispose(), other.api.dispose()]);
  });

  test("writes only the lesson a guest reaches next, counted as its start", async () => {
    const { guestApi, userId } = await createGuest(baseURL);
    const goal = await goalFixture({ userId });

    const [session, done, next, later] = await Promise.all([
      studySessionFixture({ goalId: goal.id, userId }),
      libraryLessonFixture({ contentStatus: "completed" }),
      libraryLessonFixture(),
      libraryLessonFixture(),
    ]);

    await Promise.all([
      studySessionBlockFixture({
        lessonId: done.id,
        position: 0,
        sessionId: session.id,
        status: "completed",
      }),
      studySessionBlockFixture({ lessonId: next.id, position: 1, sessionId: session.id }),
      studySessionBlockFixture({ lessonId: later.id, position: 2, sessionId: session.id }),
    ]);

    await expect(
      readBody({
        response: await guestApi.post(`/v1/study-sessions/${session.id}/preparations`),
        schema: sessionPreparationSchema,
        status: 202,
      }),
    ).resolves.toStrictEqual({ preparationId: null });

    // The day's other lessons wait until the guest opens them.
    await expect
      .poll(() =>
        prisma.usageRecord.findMany({
          select: { targetId: true },
          where: { kind: "lessonStart", userId },
        }),
      )
      .toStrictEqual([{ targetId: next.id }]);

    await expect(
      prisma.lesson.findUniqueOrThrow({ select: { contentStatus: true }, where: { id: later.id } }),
    ).resolves.toStrictEqual({ contentStatus: "pending" });

    await guestApi.dispose();
  });

  test("prepares a goal's first lessons before its first session, for its owner only", async () => {
    const [{ api, userId }, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "goal-lesson-preparation" }),
      createBearerLearner({ baseURL, prefix: "goal-lesson-preparation-other" }),
    ]);

    const goal = await goalFixture({ userId });

    await expect(
      readBody({
        response: await api.post(`/v1/goals/${goal.id}/lesson-preparations`),
        schema: sessionPreparationSchema,
        status: 202,
      }),
    ).resolves.toStrictEqual({ preparationId: expect.any(String) });

    const hidden = await other.api.post(`/v1/goals/${goal.id}/lesson-preparations`);
    expect(hidden.status()).toBe(404);

    await Promise.all([api.dispose(), other.api.dispose()]);
  });

  test("writes only the plan's first lesson for a guest's goal, counted as its start", async () => {
    const { guestApi, userId } = await createGuest(baseURL);
    const goal = await goalFixture({ userId });
    const plan = await planFixture({ goalId: goal.id });
    const [first, second] = await Promise.all([libraryLessonFixture(), libraryLessonFixture()]);

    await Promise.all([
      planItemFixture({ lessonId: first.id, planId: plan.id, position: 0 }),
      planItemFixture({ lessonId: second.id, planId: plan.id, position: 1 }),
    ]);

    await expect(
      readBody({
        response: await guestApi.post(`/v1/goals/${goal.id}/lesson-preparations`),
        schema: sessionPreparationSchema,
        status: 202,
      }),
    ).resolves.toStrictEqual({ preparationId: null });

    await expect
      .poll(() =>
        prisma.usageRecord.findMany({
          select: { targetId: true },
          where: { kind: "lessonStart", userId },
        }),
      )
      .toStrictEqual([{ targetId: first.id }]);

    await expect(
      prisma.lesson.findUniqueOrThrow({
        select: { contentStatus: true },
        where: { id: second.id },
      }),
    ).resolves.toStrictEqual({ contentStatus: "pending" });

    await guestApi.dispose();
  });

  test("records a wait for content and rejects a wait that isn't one", async () => {
    const { api } = await createBearerLearner({ baseURL, prefix: "generation-waits" });

    const recorded = await api.post("/v1/me/generation-waits", {
      data: { contentKind: "lesson", locale: "en", milliseconds: 1850, platform: "web" },
    });

    expect(recorded.status()).toBe(204);

    const invalid = await api.post("/v1/me/generation-waits", {
      data: { contentKind: "lesson", milliseconds: -5 },
    });

    expect(invalid.status()).toBe(400);

    await api.dispose();
  });

  test("starts a goal's curriculum again for its owner only, and reports the run without a session", async () => {
    const [{ api, userId }, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "goal-generation" }),
      createBearerLearner({ baseURL, prefix: "goal-generation-other" }),
    ]);

    const goal = await goalFixture({ userId });

    const response = await api.post(`/v1/goals/${goal.id}/generations`);
    const generation = await readBody({ response, schema: goalGenerationSchema, status: 202 });
    const path = `/v1/generations/${encodeURIComponent(generation.generationId)}`;

    expect(generation).toMatchObject({ goalId: goal.id, kind: "curriculum" });
    expect(response.headers().location).toBe(`/v1/generations/${generation.generationId}`);

    const hidden = await other.api.post(`/v1/goals/${goal.id}/generations`);
    expect(hidden.status()).toBe(404);

    const anonymous = await request.newContext({ baseURL });

    await expect(
      readBody({ response: await anonymous.get(path), schema: generationResourceSchema }),
    ).resolves.toMatchObject({ id: generation.generationId });

    const events = await fetch(`${baseURL}${path}/events`, { method: "HEAD" });

    expect(events.status).toBe(200);
    expect(events.headers.get("content-type")).toBe("text/event-stream");

    await Promise.all([api.dispose(), other.api.dispose(), anonymous.dispose()]);
  });

  test("starts an explain question's explanation again, not a curriculum", async () => {
    const [{ api, userId }, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "explain-generation" }),
      createBearerLearner({ baseURL, prefix: "explain-generation-other" }),
    ]);

    const goal = await goalFixture({ kind: "explain", userId });

    const response = await api.post(`/v1/goals/${goal.id}/generations`);
    const generation = await readBody({ response, schema: goalGenerationSchema, status: 202 });

    expect(generation).toMatchObject({ goalId: goal.id, kind: "explanation" });
    expect(response.headers().location).toBe(`/v1/generations/${generation.generationId}`);

    const hidden = await other.api.post(`/v1/goals/${goal.id}/generations`);
    expect(hidden.status()).toBe(404);

    await expect(
      readBody({
        response: await api.get(`/v1/generations/${encodeURIComponent(generation.generationId)}`),
        schema: generationResourceSchema,
      }),
    ).resolves.toMatchObject({ id: generation.generationId });

    await Promise.all([api.dispose(), other.api.dispose()]);
  });

  test("rejects an empty generation ID and answers an unknown one as not found", async () => {
    const anonymous = await request.newContext({ baseURL });
    const unknown = `wrun_${randomUUID()}`;

    const [emptyStatus, emptyEvents, unknownStatus, unknownEvents] = await Promise.all([
      anonymous.get("/v1/generations/%20"),
      anonymous.get("/v1/generations/%20/events"),
      anonymous.get(`/v1/generations/${unknown}`),
      anonymous.get(`/v1/generations/${unknown}/events`),
    ]);

    expect([emptyStatus.status(), emptyEvents.status()]).toStrictEqual([400, 400]);
    expect([unknownStatus.status(), unknownEvents.status()]).toStrictEqual([404, 404]);
    await expect(unknownEvents.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });

    await anonymous.dispose();
  });
});
