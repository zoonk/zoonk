import { request } from "@playwright/test";
import { lessonClockResultSchema } from "@zoonk/core/lesson-player/clock-contract";
import {
  libraryLessonCompletionSchema,
  libraryLessonRunSchema,
} from "@zoonk/core/lesson-player/contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

test.describe("lesson visibility clock", () => {
  test("pauses only the current player's interval and completes without charging time paused", async () => {
    const baseURL = process.env.E2E_BASE_URL ?? "";

    const [{ api, userId }, { api: intruder }, visitor, { lesson }] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "clock" }),
      createBearerLearner({ baseURL, prefix: "clock-intruder" }),
      request.newContext({ baseURL }),
      playableLessonFixture({ steps: ["explanation", "summary"] }),
    ]);

    const session = await studySessionFixture({ userId });

    const block = await studySessionBlockFixture({
      kind: "learn",
      lessonId: lesson.id,
      sessionId: session.id,
    });

    const run = await readBody({
      response: await api.post(`/v1/library/lessons/${lesson.id}/starts`, {
        data: { opening: { target: { blockId: block.id, kind: "block" } }, timeZone: "UTC" },
      }),
      schema: libraryLessonRunSchema,
      status: 201,
    });

    expect(run.clockId).toBeTruthy();
    const path = `/v1/library/lessons/${lesson.id}/clock`;
    const data = { clockId: run.clockId, runId: run.runId, sequence: 1, state: "paused" };

    const [foreign, signedOut, malformed] = await Promise.all([
      intruder.post(path, { data }),
      visitor.post(path, { data }),
      api.post(path, { data: { ...data, userId } }),
    ]);

    expect(foreign.status()).toBe(404);
    expect(signedOut.status()).toBe(401);
    expect(malformed.status()).toBe(400);
    await readBody({ response: await api.post(path, { data }), schema: lessonClockResultSchema });
    const paused = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });
    const payload = paused.payload as { timing: { activeAt: string | null; elapsedMs: number } };
    expect(payload.timing.activeAt).toBeNull();

    const repeated = await api.post(path, { data });
    await expect(repeated.json()).resolves.toStrictEqual({ status: "ignored" });

    const resumed = await readBody({
      response: await api.post(`/v1/library/lessons/${lesson.id}/starts`, {
        data: { runId: run.runId, timeZone: "UTC" },
      }),
      schema: libraryLessonRunSchema,
      status: 201,
    });

    expect(resumed.clockId).not.toBe(run.clockId);

    const stale = await api.post(path, { data: { ...data, sequence: 2 } });
    await expect(stale.json()).resolves.toStrictEqual({ status: "ignored" });

    const pausedAgain = await api.post(path, { data: { ...data, clockId: resumed.clockId } });
    await expect(pausedAgain.json()).resolves.toStrictEqual({ status: "updated" });

    const finalPause = await prisma.studySessionBlock.findUniqueOrThrow({
      where: { id: block.id },
    });

    const finalPayload = finalPause.payload as { timing: { elapsedMs: number } };

    await readBody({
      response: await api.post(`/v1/library/lessons/${lesson.id}/completions`, {
        data: { runId: run.runId, timeZone: "UTC" },
      }),
      schema: libraryLessonCompletionSchema,
    });

    const completed = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });

    const completedPayload = completed.payload as {
      timing: { activeAt: string | null; recordedMs: number };
    };

    expect(completed.status).toBe("completed");
    expect(completedPayload.timing.activeAt).toBeNull();
    expect(completedPayload.timing.recordedMs).toBe(finalPayload.timing.elapsedMs);

    const finished = await api.post(path, {
      data: { ...data, clockId: resumed.clockId, sequence: 2, state: "running" },
    });

    await expect(finished.json()).resolves.toStrictEqual({ status: "ignored" });

    await Promise.all([api.dispose(), intruder.dispose(), visitor.dispose()]);
  });
});
