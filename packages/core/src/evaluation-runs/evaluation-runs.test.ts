import { type EvaluationRunRecord } from "@zoonk/ai/evaluation-run-sink";
import { prisma } from "@zoonk/db";
import { evaluationRunFixture } from "@zoonk/testing/fixtures/evaluation-runs";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { registerEvaluationRunLog } from "./evaluation-run-log";
import { purgeEvaluationRuns } from "./purge-evaluation-runs";

const DAY_MS = 86_400_000;

function runRecord(attrs: Partial<EvaluationRunRecord> = {}): EvaluationRunRecord {
  return {
    answers: { label: { choice: "law", probabilities: { law: 0.9, none: 0.1 }, type: "choice" } },
    contentScope: "personal",
    input: { GOAL: `Pass the driving test ${crypto.randomUUID()}` },
    inputHash: `hash-${crypto.randomUUID()}`,
    latencyMs: 210,
    model: "typesafe-ai/jev",
    promptVersion: "prompt-1",
    requestedModel: "typesafe-ai/jev",
    runId: crypto.randomUUID(),
    task: "changing-facts",
    ...attrs,
  };
}

/** `@zoonk/ai` never calls a sink under tests, so this calls the registered log directly. */
async function recordEvaluationRun(record: EvaluationRunRecord) {
  registerEvaluationRunLog();
  await globalThis.zoonkEvaluationRunSink?.(record);
}

function findByHash(inputHash: string) {
  return prisma.evaluationRun.findFirstOrThrow({ where: { inputHash } });
}

describe(registerEvaluationRunLog, () => {
  it("stores a learner's run with its verdict and input, and deletes it with the learner", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const record = runRecord({ distinctId: user.id, goalId: goal.id });

    await recordEvaluationRun(record);

    const stored = await findByHash(record.inputHash);

    expect(stored).toMatchObject({
      answers: record.answers,
      contentScope: "personal",
      goalId: goal.id,
      input: record.input,
      model: "typesafe-ai/jev",
      task: "changing-facts",
      userId: user.id,
    });

    await prisma.user.delete({ where: { id: user.id } });

    await expect(prisma.evaluationRun.findUnique({ where: { id: stored.id } })).resolves.toBeNull();
  });

  it("keeps the verdict but drops the link and input when the learner is already gone", async () => {
    const record = runRecord({ distinctId: crypto.randomUUID() });

    await recordEvaluationRun(record);

    await expect(findByHash(record.inputHash)).resolves.toMatchObject({
      answers: record.answers,
      goalId: null,
      input: null,
      userId: null,
    });
  });

  it("stores system work without a learner, and no input when the task keeps none", async () => {
    const record = runRecord({
      contentScope: "shared",
      distinctId: "zoonk-system",
      input: null,
      task: "memory-gate",
    });

    await recordEvaluationRun(record);

    await expect(findByHash(record.inputHash)).resolves.toMatchObject({
      input: null,
      task: "memory-gate",
      userId: null,
    });
  });
});

describe(purgeEvaluationRuns, () => {
  it("removes runs older than 30 days and keeps recent ones", async () => {
    const now = Date.now();

    const [old, recent] = await Promise.all([
      evaluationRunFixture({ createdAt: new Date(now - 31 * DAY_MS) }),
      evaluationRunFixture({ createdAt: new Date(now - 29 * DAY_MS) }),
    ]);

    const { purged } = await purgeEvaluationRuns();

    expect(purged).toBeGreaterThanOrEqual(1);

    await Promise.all([
      expect(prisma.evaluationRun.findUnique({ where: { id: old.id } })).resolves.toBeNull(),
      expect(prisma.evaluationRun.findUnique({ where: { id: recent.id } })).resolves.not.toBeNull(),
    ]);
  });
});
