import { randomUUID } from "node:crypto";
import { type APIRequestContext, type APIResponse, request } from "@playwright/test";
import {
  languageConversationSetupSchema,
  liveCallSdpResponseSchema,
} from "@zoonk/core/language/conversations/contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { RENTING_SCENARIO, languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { TEST_LIVE_SDP_ANSWER } from "../../../packages/e2e/src/live-call-provider";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

/** The lane's Next alias replaces only @zoonk/ai with a fixed no-spend provider answer. */
async function callFixture(prefix: string) {
  const learner = await createBearerLearner({ baseURL: process.env.E2E_BASE_URL ?? "", prefix });
  const { renting } = await languageGoalFixture({ userId: learner.userId });

  const response = await learner.api.post("/v1/language-conversations", {
    data: { chapterId: renting.id, kind: "practice", minutes: 1 },
  });

  expect(response.status()).toBe(201);
  const { conversationId } = (await response.json()) as { conversationId: string };

  return {
    ...learner,
    conversationId,
    path: `/v1/language-conversations/${conversationId}/connections`,
  };
}

async function statusOf(responsePromise: Promise<APIResponse>) {
  const response = await responsePromise;
  return response.status();
}

async function assertEnded(api: APIRequestContext, path: string) {
  const response = await api.post(path);
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toStrictEqual({ status: "closed" });
}

async function connectionState(connectionId: string) {
  const connection = await prisma.liveCallConnection.findUniqueOrThrow({
    where: { id: connectionId },
  });

  return connection.state;
}

test.describe("Live-call connection HTTP contract", () => {
  test("reserves with a receipt, redeems SDP once, keeps it private and ends idempotently", async () => {
    const learner = await callFixture("live-contract");

    const stranger = await createBearerLearner({
      baseURL: process.env.E2E_BASE_URL ?? "",
      prefix: "live-stranger",
    });

    try {
      const input = { requestId: randomUUID() };
      const reserved = await learner.api.post(learner.path, { data: input });

      const setup = await readBody({
        response: reserved,
        schema: languageConversationSetupSchema,
        status: 201,
      });

      expect(reserved.headers()["cache-control"]).toBe("no-store");
      expect(setup.sessionUrl).toBe(`${learner.path}/${setup.connectionId}/sdp`);
      expect(new Date(setup.deadlineAt).getTime()).toBeGreaterThan(Date.now());

      const stored = await prisma.liveCallConnection.findUniqueOrThrow({
        where: { id: setup.connectionId },
      });

      expect(stored).toMatchObject({ providerSessionId: null, state: "pending" });
      expect(stored.workflowRunId).toBeTruthy();
      const repeated = await learner.api.post(learner.path, { data: input });
      const replay = languageConversationSetupSchema.parse(await repeated.json());

      expect(replay).toMatchObject({
        connectionId: setup.connectionId,
        deadlineAt: setup.deadlineAt,
      });

      expect(replay.seconds).toBeLessThanOrEqual(setup.seconds);

      const hidden = await stranger.api.post(setup.sessionUrl, { data: { sdp: "offer" } });
      expect(hidden.status()).toBe(404);

      const answer = await learner.api.post(setup.sessionUrl, {
        data: { sdp: "offer", sessionConfig: { instructions: "untrusted" } },
      });

      const session = await readBody({
        response: answer,
        schema: liveCallSdpResponseSchema,
        status: 201,
      });

      expect(session.sdp).toBe(TEST_LIVE_SDP_ANSWER);
      expect(answer.headers()["cache-control"]).toBe("no-store");
      const duplicate = await learner.api.post(setup.sessionUrl, { data: { sdp: "offer" } });
      expect(duplicate.status()).toBe(409);
      await expect(duplicate.json()).resolves.toMatchObject({ error: { code: "CONNECTION_USED" } });

      const endPath = `${learner.path}/${setup.connectionId}/end`;
      await expect(statusOf(stranger.api.post(endPath))).resolves.toBe(404);

      await assertEnded(learner.api, endPath);
      await assertEnded(learner.api, endPath);
      await expect.poll(() => connectionState(setup.connectionId)).toBe("closed");
    } finally {
      await Promise.all([learner.api.dispose(), stranger.api.dispose()]);
    }
  });

  test("requires authentication, validates input and refuses expired or untimed SDP", async () => {
    const learner = await callFixture("live-refusals");
    const anonymous = await request.newContext({ baseURL: process.env.E2E_BASE_URL ?? "" });

    try {
      await expect(statusOf(anonymous.post(learner.path))).resolves.toBe(401);

      await expect(
        statusOf(anonymous.post(`${learner.path}/${randomUUID()}/sdp`, { data: { sdp: "offer" } })),
      ).resolves.toBe(401);

      await expect(
        statusOf(learner.api.post(learner.path, { data: { takeover: "yes" } })),
      ).resolves.toBe(400);

      const setup = await readBody({
        response: await learner.api.post(learner.path),
        schema: languageConversationSetupSchema,
        status: 201,
      });

      await expect(
        statusOf(learner.api.post(setup.sessionUrl, { data: { sdp: "" } })),
      ).resolves.toBe(400);

      await prisma.liveCallConnection.update({
        data: { workflowRunId: null },
        where: { id: setup.connectionId },
      });

      const untimed = await learner.api.post(setup.sessionUrl, { data: { sdp: "offer" } });
      expect(untimed.status()).toBe(503);
      await expect(untimed.json()).resolves.toMatchObject({ error: { code: "CALL_RETRYABLE" } });

      await prisma.liveCallConnection.update({
        data: { deadlineAt: new Date(Date.now() - 1000), workflowRunId: "expired-test-receipt" },
        where: { id: setup.connectionId },
      });

      const expired = await learner.api.post(setup.sessionUrl, { data: { sdp: "offer" } });
      expect(expired.status()).toBe(409);

      await expect(expired.json()).resolves.toMatchObject({
        error: { code: "CONNECTION_EXPIRED" },
      });
    } finally {
      await Promise.all([learner.api.dispose(), anonymous.dispose()]);
    }
  });

  test("requires explicit takeover for a different call and fences the old reservation", async () => {
    const learner = await callFixture("live-takeover");

    try {
      const first = await readBody({
        response: await learner.api.post(learner.path),
        schema: languageConversationSetupSchema,
        status: 201,
      });

      const saved = await prisma.languageConversation.findUniqueOrThrow({
        where: { id: learner.conversationId },
      });

      const second = await prisma.languageConversation.create({
        data: {
          chapterId: saved.chapterId,
          goalId: saved.goalId,
          kind: "practice",
          language: saved.language,
          level: saved.level,
          minutes: saved.minutes,
          scenario: RENTING_SCENARIO,
          targetLanguage: saved.targetLanguage,
          titleSnapshot: saved.titleSnapshot,
          userId: learner.userId,
        },
      });

      const path = `/v1/language-conversations/${second.id}/connections`;
      const refused = await learner.api.post(path);
      expect(refused.status()).toBe(409);

      await expect(refused.json()).resolves.toMatchObject({
        error: {
          code: "CALL_IN_PROGRESS",
          details: { connectionId: first.connectionId, conversationId: learner.conversationId },
        },
      });

      const replacement = await readBody({
        response: await learner.api.post(path, { data: { takeover: true } }),
        schema: languageConversationSetupSchema,
        status: 201,
      });

      expect(replacement.connectionId).not.toBe(first.connectionId);

      await expect(
        statusOf(learner.api.post(first.sessionUrl, { data: { sdp: "offer" } })),
      ).resolves.toBe(409);

      const completion = await learner.api.post(
        `/v1/language-conversations/${learner.conversationId}/completions`,
        {
          data: {
            connectionId: first.connectionId,
            spokenSeconds: 0,
            timeZone: "UTC",
            turns: [],
            usedHelp: false,
          },
        },
      );

      expect(completion.status()).toBe(409);

      await expect(completion.json()).resolves.toMatchObject({
        error: { code: "CALL_TAKEN_OVER" },
      });

      await learner.api.post(`${path}/${replacement.connectionId}/end`);
    } finally {
      await learner.api.dispose();
    }
  });

  test("refuses an old same-call completion without closing the replacement", async () => {
    const learner = await callFixture("live-stale-complete");

    try {
      const first = await readBody({
        response: await learner.api.post(learner.path),
        schema: languageConversationSetupSchema,
        status: 201,
      });

      await expect(
        statusOf(learner.api.post(first.sessionUrl, { data: { sdp: "offer" } })),
      ).resolves.toBe(201);

      const replacement = await readBody({
        response: await learner.api.post(learner.path),
        schema: languageConversationSetupSchema,
        status: 201,
      });

      const stale = await learner.api.post(
        `/v1/language-conversations/${learner.conversationId}/completions`,
        {
          data: {
            connectionId: first.connectionId,
            spokenSeconds: 0,
            timeZone: "UTC",
            turns: [],
            usedHelp: false,
          },
        },
      );

      expect(stale.status()).toBe(409);
      await expect(stale.json()).resolves.toMatchObject({ error: { code: "CONVERSATION_ENDED" } });
      expect(await connectionState(replacement.connectionId)).toBe("pending");

      const slot = await prisma.liveCallSlot.findUniqueOrThrow({
        where: { userId: learner.userId },
      });

      expect(slot.connectionId).toBe(replacement.connectionId);

      await expect(
        statusOf(learner.api.post(replacement.sessionUrl, { data: { sdp: "offer" } })),
      ).resolves.toBe(201);

      await learner.api.post(`${learner.path}/${replacement.connectionId}/end`);
    } finally {
      await learner.api.dispose();
    }
  });
});
