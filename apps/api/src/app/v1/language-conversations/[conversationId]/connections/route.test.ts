import { randomUUID } from "node:crypto";
import { authenticatedCallFixture } from "@/workflows/v2/calls/_test-utils/live-call-fixtures";
import { liveCallDeadlineWorkflow } from "@/workflows/v2/calls/live-call-deadline-workflow";
import {
  closeLiveCallSession,
  createLiveCallSession,
  isLiveCallAvailable,
} from "@zoonk/ai/tasks/v2/language/live-call-session";
import {
  liveCallAdmissionInputSchema,
  liveCallAdmissionResponseSchema,
  liveCallCloseAllResponseSchema,
} from "@zoonk/core/language/conversations/admission-contract";
import {
  languageConversationSetupSchema,
  liveCallSdpResponseSchema,
} from "@zoonk/core/language/conversations/contract";
import { prisma } from "@zoonk/db";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { GET as readAdmission, POST as updateAdmission } from "../../../live-calls/admission/route";
import { POST as closeAll } from "../../../live-calls/close-all/route";
import { POST as end } from "./[connectionId]/end/route";
import { POST as redeem } from "./[connectionId]/sdp/route";
import { POST as reserve } from "./route";

/** Auth and PostgreSQL are real; only Workflow enqueue and the AI provider are replaced. */
vi.mock("@zoonk/ai/tasks/v2/language/live-call-session", () => ({
  closeLiveCallSession: vi.fn(),
  createLiveCallSession: vi.fn(),
  isLiveCallAvailable: vi.fn(),
}));

function request(path: string, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

function reserveCall(conversationId: string, body?: unknown) {
  return reserve(request(`/v1/language-conversations/${conversationId}/connections`, body), {
    params: Promise.resolve({ conversationId }),
  });
}

function redeemCall(conversationId: string, connectionId: string, body?: unknown) {
  return redeem(
    request(
      `/v1/language-conversations/${conversationId}/connections/${connectionId}/sdp`,
      body ?? { sdp: "offer" },
    ),
    { params: Promise.resolve({ connectionId, conversationId }) },
  );
}

function endCall(conversationId: string, connectionId: string) {
  return end(
    request(`/v1/language-conversations/${conversationId}/connections/${connectionId}/end`),
    { params: Promise.resolve({ connectionId, conversationId }) },
  );
}

async function statusOf(responsePromise: Promise<Response>) {
  const response = await responsePromise;
  return response.status;
}

async function setupOf(responsePromise: Promise<Response>) {
  const response = await responsePromise;
  return languageConversationSetupSchema.parse(await response.json());
}

describe("Live-call API adapters with real core and PostgreSQL", () => {
  beforeEach(async () => {
    vi.mocked(isLiveCallAvailable).mockReturnValue(true);

    vi.mocked(createLiveCallSession).mockImplementation(async () => ({
      sdp: "answer",
      sessionId: randomUUID(),
    }));

    vi.mocked(closeLiveCallSession).mockResolvedValue({
      reason: "close_requested",
      seconds: 15,
      status: "closed",
    });

    await prisma.liveCallSetting.upsert({
      create: { admission: "all", freeDailyBudgetMicros: 100_000_000, id: "live" },
      update: { admission: "all", freeDailyBudgetMicros: 100_000_000 },
      where: { id: "live" },
    });
  });

  it("reserves without spend, persists the timer receipt, then redeems and ends once", async () => {
    const { conversationId, user } = await authenticatedCallFixture();
    const response = await reserveCall(conversationId, { requestId: randomUUID() });
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const setup = languageConversationSetupSchema.parse(await response.json());
    expect(createLiveCallSession).not.toHaveBeenCalled();

    expect(start).toHaveBeenCalledWith(liveCallDeadlineWorkflow, [
      {
        connectionId: setup.connectionId,
        deadlineAt: new Date(setup.deadlineAt),
        generation: setup.generation,
      },
    ]);

    const saved = await prisma.liveCallConnection.findUniqueOrThrow({
      where: { id: setup.connectionId },
    });

    expect(saved.workflowRunId).toBeTruthy();

    const answer = await redeemCall(conversationId, setup.connectionId, {
      sdp: "offer",
      sessionConfig: { instructions: "untrusted", model: "untrusted" },
    });

    expect(answer.status).toBe(201);
    expect(answer.headers.get("Cache-Control")).toBe("no-store");
    expect(liveCallSdpResponseSchema.parse(await answer.json()).sdp).toBe("answer");

    expect(createLiveCallSession).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ sdp: "offer", voice: setup.voice }),
    );

    expect(vi.mocked(createLiveCallSession).mock.calls[0]?.[0].instructions).not.toBe("untrusted");
    await expect(statusOf(redeemCall(conversationId, setup.connectionId))).resolves.toBe(409);
    await expect(statusOf(endCall(conversationId, setup.connectionId))).resolves.toBe(200);
    await expect(statusOf(endCall(conversationId, setup.connectionId))).resolves.toBe(200);
    expect(closeLiveCallSession).toHaveBeenCalledOnce();

    await expect(
      prisma.liveCallSlot.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ connectionId: null });
  });

  it("reuses the same reservation and receipt for a retried request", async () => {
    const { conversationId } = await authenticatedCallFixture();
    const input = { requestId: randomUUID() };
    const first = await reserveCall(conversationId, input);
    const again = await reserveCall(conversationId, input);
    expect(again.status).toBe(201);
    const initial = languageConversationSetupSchema.parse(await first.json());
    const replay = languageConversationSetupSchema.parse(await again.json());

    expect(replay).toMatchObject({
      connectionId: initial.connectionId,
      deadlineAt: initial.deadlineAt,
      endsAtLimit: initial.endsAtLimit,
      generation: initial.generation,
      sessionUrl: initial.sessionUrl,
    });

    expect(replay.seconds).toBeLessThanOrEqual(initial.seconds);
    expect(start).toHaveBeenCalledOnce();
  });

  it("maps timer start failure to a retryable response and refunds the pending hold", async () => {
    const { conversationId, user } = await authenticatedCallFixture();
    vi.mocked(start).mockRejectedValueOnce(new Error("Queue unavailable"));
    const response = await reserveCall(conversationId);
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("5");
    await expect(response.json()).resolves.toMatchObject({ error: { code: "CALL_RETRYABLE" } });

    await expect(
      prisma.liveCallSlot.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ connectionId: null });

    expect(createLiveCallSession).not.toHaveBeenCalled();
  });

  it("rechecks availability at SDP and refuses paused calls without provider creation", async () => {
    const { conversationId } = await authenticatedCallFixture();
    const reserved = await reserveCall(conversationId);
    const setup = languageConversationSetupSchema.parse(await reserved.json());
    vi.mocked(isLiveCallAvailable).mockReturnValue(false);
    const response = await redeemCall(conversationId, setup.connectionId);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "CALLS_PAUSED" } });
    expect(createLiveCallSession).not.toHaveBeenCalled();
  });

  it("keeps an unconfirmed End retryable and leaves the original slot held", async () => {
    const { conversationId, user } = await authenticatedCallFixture();

    const setup = await setupOf(reserveCall(conversationId));

    await expect(statusOf(redeemCall(conversationId, setup.connectionId))).resolves.toBe(201);
    vi.mocked(closeLiveCallSession).mockRejectedValue(new Error("Sideband unavailable"));
    const response = await endCall(conversationId, setup.connectionId);
    expect(response.status).toBe(409);
    expect(response.headers.get("Retry-After")).toBe("5");

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PREVIOUS_CONNECTION_CLOSING" },
    });

    await expect(
      prisma.liveCallSlot.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ connectionId: setup.connectionId });
  });

  it("rejects malformed request bodies and connection IDs before spending", async () => {
    const { conversationId } = await authenticatedCallFixture();
    await expect(statusOf(reserveCall(conversationId, { takeover: "yes" }))).resolves.toBe(400);
    await expect(statusOf(redeemCall(conversationId, "bad-id"))).resolves.toBe(400);

    await expect(statusOf(redeemCall(conversationId, randomUUID(), { sdp: "" }))).resolves.toBe(
      400,
    );

    expect(start).not.toHaveBeenCalled();
    expect(createLiveCallSession).not.toHaveBeenCalled();
  });

  it("accepts a zero-byte body stream and still reaches authorization for an empty POST", async () => {
    const { conversationId } = await authenticatedCallFixture();
    const path = `/v1/language-conversations/${conversationId}/connections`;
    const empty = new NextRequest(`http://localhost${path}`, { body: "", method: "POST" });
    expect(empty.body).not.toBeNull();
    const response = await reserve(empty, { params: Promise.resolve({ conversationId }) });
    expect(response.status).toBe(201);

    const malformed = new NextRequest(`http://localhost${path}`, { body: "{", method: "POST" });

    await expect(
      statusOf(reserve(malformed, { params: Promise.resolve({ conversationId }) })),
    ).resolves.toBe(400);

    vi.mocked(headers).mockResolvedValue(new Headers());
    const anonymous = new NextRequest(`http://localhost${path}`, { body: "", method: "POST" });

    await expect(
      statusOf(reserve(anonymous, { params: Promise.resolve({ conversationId }) })),
    ).resolves.toBe(401);

    expect(createLiveCallSession).not.toHaveBeenCalled();
  });

  it("authorizes every admin operation, serializes reads without spend and disables before close-all", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers());
    const input = { admission: "all", freeDailyBudgetMicros: 100_000_000 };
    await expect(statusOf(readAdmission())).resolves.toBe(401);

    await expect(
      statusOf(updateAdmission(request("/v1/live-calls/admission", input))),
    ).resolves.toBe(401);

    await expect(statusOf(closeAll())).resolves.toBe(401);
    await authenticatedCallFixture();
    await expect(statusOf(readAdmission())).resolves.toBe(403);

    await expect(
      statusOf(updateAdmission(request("/v1/live-calls/admission", input))),
    ).resolves.toBe(403);

    await expect(statusOf(closeAll())).resolves.toBe(403);

    const { conversationId } = await authenticatedCallFixture("admin");

    try {
      const saved = await updateAdmission(request("/v1/live-calls/admission", input));
      expect(saved.status).toBe(200);
      expect(liveCallAdmissionInputSchema.parse(await saved.json())).toStrictEqual(input);
      const read = await readAdmission();
      expect(read.headers.get("Cache-Control")).toBe("no-store");

      expect(liveCallAdmissionResponseSchema.parse(await read.json())).toMatchObject({
        providerAvailable: true,
        setting: input,
      });

      expect(createLiveCallSession).not.toHaveBeenCalled();
      expect(closeLiveCallSession).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
      const setup = await setupOf(reserveCall(conversationId));
      await expect(statusOf(redeemCall(conversationId, setup.connectionId))).resolves.toBe(201);

      vi.mocked(closeLiveCallSession).mockImplementation(async () => {
        const setting = await prisma.liveCallSetting.findUniqueOrThrow({ where: { id: "live" } });
        expect(setting.admission).toBe("off");
        return { reason: "close_requested", seconds: 15, status: "closed" };
      });

      const closed = await closeAll();
      expect(closed.status).toBe(200);
      expect(liveCallCloseAllResponseSchema.parse(await closed.json()).closed).toBeGreaterThan(0);

      await expect(
        prisma.liveCallConnection.findUniqueOrThrow({ where: { id: setup.connectionId } }),
      ).resolves.toMatchObject({ state: "closed" });
    } finally {
      await updateAdmission(request("/v1/live-calls/admission", input));
    }
  });
});
