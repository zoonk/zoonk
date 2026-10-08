import { type AiGeneration } from "@zoonk/ai/ai-generation-sink";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it } from "vitest";
import { registerAiCallLog } from "./ai-call-log";
import { toAiCallRow, writeAiCalls } from "./write-ai-calls";

const FLUSH_WAIT_MS = 3000;
const POLL_MS = 100;

function generation(attrs: Partial<AiGeneration> = {}): AiGeneration {
  return {
    provenance: {
      costUsd: 0.0042,
      credential: "byok",
      gatewayCostUsd: 0.0041,
      generatedAt: "2026-10-06T12:00:00.000Z",
      latencyMs: 1800,
      model: "openai/gpt-6-sol",
      promptVersion: "prompt-1",
      provider: "openai",
      requestedModel: "openai/gpt-6-sol",
      runId: crypto.randomUUID(),
      serviceTier: "flex",
      usage: {
        cacheReadTokens: 600,
        cacheWriteTokens: 100,
        inputTokens: 1000,
        outputTokens: 300,
        reasoningTokens: 120,
        totalTokens: 1300,
      },
    },
    task: "course-outline",
    ...attrs,
  };
}

function findRun(runId: string) {
  return prisma.aiCall.findFirst({ where: { runId } });
}

/** The log saves in the background a second after a call, so the test waits for the row. */
async function waitForRun(
  runId: string,
  waited = 0,
): Promise<NonNullable<Awaited<ReturnType<typeof findRun>>>> {
  const row = await findRun(runId);

  if (row || waited >= FLUSH_WAIT_MS) {
    if (!row) {
      throw new Error(`AI call ${runId} was never saved.`);
    }

    return row;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, POLL_MS);
  });

  return waitForRun(runId, waited + POLL_MS);
}

describe(writeAiCalls, () => {
  it("keeps a learner's call with its usage, tier and cost, and its cost after the learner leaves", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const call = generation({
      context: {
        contentScope: "personal",
        distinctId: user.id,
        goalId: goal.id,
        traceId: "wrun-1",
      },
    });

    await writeAiCalls([toAiCallRow(call)]);

    const stored = await findRun(call.provenance.runId);

    expect(stored).toMatchObject({
      cacheReadTokens: 600,
      cacheWriteTokens: 100,
      contentScope: "personal",
      costUsd: 0.0042,
      credential: "byok",
      gatewayCostUsd: 0.0041,
      goalId: goal.id,
      inputTokens: 1000,
      latencyMs: 1800,
      model: "openai/gpt-6-sol",
      outputTokens: 300,
      reasoningTokens: 120,
      serviceTier: "flex",
      task: "course-outline",
      traceId: "wrun-1",
      userId: user.id,
    });

    await prisma.user.delete({ where: { id: user.id } });

    await expect(findRun(call.provenance.runId)).resolves.toMatchObject({
      costUsd: 0.0042,
      goalId: null,
      userId: null,
    });
  });

  it("keeps the calls of a learner or goal deleted while they ran, without the link", async () => {
    const user = await userFixture();

    const kept = generation({ context: { distinctId: user.id } });

    const orphaned = generation({
      context: { distinctId: crypto.randomUUID(), goalId: crypto.randomUUID() },
    });

    await writeAiCalls([toAiCallRow(kept), toAiCallRow(orphaned)]);

    await expect(findRun(kept.provenance.runId)).resolves.toMatchObject({ userId: user.id });

    await expect(findRun(orphaned.provenance.runId)).resolves.toMatchObject({
      costUsd: 0.0042,
      goalId: null,
      userId: null,
    });
  });

  it("stores system work as shared, and a call billed by length with its seconds", async () => {
    const call = generation({
      context: { distinctId: "zoonk-system" },
      provenance: {
        ...generation().provenance,
        costUsd: 0.05,
        model: "openai/gpt-live-1",
        usage: { audioSeconds: 60 },
      },
      task: "live-conversation",
    });

    await writeAiCalls([toAiCallRow(call)]);

    await expect(findRun(call.provenance.runId)).resolves.toMatchObject({
      audioSeconds: 60,
      contentScope: "shared",
      costUsd: 0.05,
      inputTokens: 0,
      userId: null,
    });
  });

  it("leaves the cost empty for a model the price list doesn't know", async () => {
    const call = generation({ provenance: { ...generation().provenance, costUsd: undefined } });

    await writeAiCalls([toAiCallRow(call)]);

    await expect(findRun(call.provenance.runId)).resolves.toMatchObject({ costUsd: null });
  });
});

describe(registerAiCallLog, () => {
  afterEach(() => {
    globalThis.zoonkAiGenerationSinks = undefined;
  });

  it("saves calls in the background, together, once they finish", async () => {
    registerAiCallLog();
    const sink = globalThis.zoonkAiGenerationSinks?.get("ai-calls");
    const calls = [generation(), generation(), generation()];

    await Promise.all(calls.map(async (call) => sink?.(call)));

    // Queued, not written yet: nothing waits on the database on the learner's path.
    await expect(findRun(calls[0]?.provenance.runId ?? "")).resolves.toBeNull();

    const saved = await Promise.all(calls.map((call) => waitForRun(call.provenance.runId)));

    expect(saved.map((row) => row.task)).toStrictEqual([
      "course-outline",
      "course-outline",
      "course-outline",
    ]);
  });
});
