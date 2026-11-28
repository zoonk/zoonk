import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { useIsolatedBudgetDay } from "../../../_test-utils/isolated-budget-day";
import { mockGuestSession, mockSession } from "../../../_test-utils/mock-session";
import { GUEST_DAILY_SPEND_BUDGET_MICROS, getUsageRule } from "../../../entitlements/limits";
import { scriptedSandbox } from "./_test-utils/scripted-sandbox";
import { runLearnerProgram } from "./run-learner-program";
import { type CodeRunInput, codeRunInputSchema } from "./sandbox-contract";
import { sandboxDriver } from "./sandbox-driver";
import { sandboxCostMicros } from "./sandbox-languages";

vi.mock("./sandbox-driver", () => ({ sandboxDriver: { fork: vi.fn(), reuse: vi.fn() } }));

function program(language: CodeRunInput["language"] = "cpp"): CodeRunInput {
  return { code: "example", language, requestId: randomUUID() };
}

async function finish(admission: Awaited<ReturnType<typeof runLearnerProgram>>) {
  if (admission.status !== "start") {
    throw new Error(`Expected an admission, got ${admission.status}`);
  }

  return admission.run(() => {});
}

describe("learner code run admission", () => {
  it("admits one run across languages and replays a request without calling the driver again", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const first = program();
    const second = program("java");
    const admissions = await Promise.all([runLearnerProgram(first), runLearnerProgram(second)]);
    const started = admissions.findIndex(({ status }) => status === "start");
    const admitted = started === 0 ? first : second;
    const winner = admissions.find(({ status }) => status === "start");

    expect(admissions.map(({ status }) => status).toSorted()).toStrictEqual([
      "alreadyRunning",
      "start",
    ]);

    if (!winner) {
      throw new Error("No run was admitted");
    }

    await expect(runLearnerProgram(admitted)).resolves.toStrictEqual({ status: "alreadyRunning" });
    expect(sandboxDriver.fork).not.toHaveBeenCalled();

    const [row] = await prisma.codeRun.findMany({ where: { userId: user.id } });

    const [charge] = await prisma.usageRecord.findMany({
      where: { kind: "codeRun", userId: user.id },
    });

    expect(charge).toMatchObject({
      costMicros: sandboxCostMicros(admitted.language),
      targetId: row?.id,
    });

    vi.mocked(sandboxDriver.fork).mockResolvedValueOnce(
      scriptedSandbox({ run: { stdout: "hello" } }),
    );

    const result = await finish(winner);
    await expect(runLearnerProgram(admitted)).resolves.toStrictEqual({ result, status: "replay" });
    expect(sandboxDriver.fork).toHaveBeenCalledOnce();
  });

  it("reuses the latest finished sandbox for the same language and forks when reuse fails", async () => {
    const user = await userFixture();
    mockSession(user.id);
    vi.mocked(sandboxDriver.fork).mockResolvedValue(scriptedSandbox());

    vi.mocked(sandboxDriver.reuse)
      .mockResolvedValueOnce(scriptedSandbox())
      .mockRejectedValueOnce(new Error("Session ended"));

    const first = await finish(await runLearnerProgram(program()));
    const second = await finish(await runLearnerProgram(program()));
    await finish(await runLearnerProgram(program()));

    const rows = await prisma.codeRun.findMany({
      where: { id: { in: [first.runId, second.runId] } },
    });

    expect(new Set(rows.map(({ sandboxName }) => sandboxName)).size).toBe(1);
    expect(sandboxDriver.fork).toHaveBeenCalledTimes(2);
    expect(sandboxDriver.reuse).toHaveBeenCalledTimes(2);
  });

  it("forks fresh after a run that timed out", async () => {
    const user = await userFixture();
    mockSession(user.id);

    vi.mocked(sandboxDriver.fork)
      .mockResolvedValueOnce(scriptedSandbox({ run: { exitCode: 137 } }))
      .mockResolvedValueOnce(scriptedSandbox());

    await expect(finish(await runLearnerProgram(program()))).resolves.toMatchObject({
      stop: "timeout",
    });

    await expect(finish(await runLearnerProgram(program()))).resolves.toMatchObject({
      stop: "done",
    });

    expect(sandboxDriver.reuse).not.toHaveBeenCalled();
    expect(sandboxDriver.fork).toHaveBeenCalledTimes(2);
  });

  it("lets a lost run expire and replays its request as unavailable", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const lost = program();
    const id = randomUUID();

    await prisma.codeRun.create({
      data: {
        id,
        language: lost.language,
        requestId: lost.requestId,
        sandboxName: `run-${id}`,
        startedAt: new Date(Date.now() - 120_000),
        userId: user.id,
      },
    });

    await expect(runLearnerProgram(lost)).resolves.toMatchObject({
      result: { runId: id, stop: "unavailable" },
      status: "replay",
    });

    await expect(runLearnerProgram(program("java"))).resolves.toMatchObject({ status: "start" });
    expect(sandboxDriver.fork).not.toHaveBeenCalled();
  });

  it("refuses a capped learner before writing a run or calling the driver", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await usageRecordsFixture({
      count: getUsageRule({ kind: "codeRun", tier: "free" }).day ?? 0,
      kind: "codeRun",
      userId: user.id,
    });

    await expect(runLearnerProgram(program())).resolves.toMatchObject({
      limit: { period: "day", resource: "codeRun" },
      status: "limitReached",
    });

    await expect(prisma.codeRun.count({ where: { userId: user.id } })).resolves.toBe(0);
    expect(sandboxDriver.fork).not.toHaveBeenCalled();
  });

  it("refuses a guest when the shared budget is spent", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });

    try {
      await useIsolatedBudgetDay();
      const user = await userFixture();
      mockGuestSession(user.id);
      const now = new Date();

      await prisma.guestSpendDay.create({
        data: {
          day: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
          spentMicros: GUEST_DAILY_SPEND_BUDGET_MICROS,
        },
      });

      await expect(runLearnerProgram(program())).resolves.toStrictEqual({
        status: "signUpRequired",
      });

      await expect(prisma.codeRun.count({ where: { userId: user.id } })).resolves.toBe(0);
      expect(sandboxDriver.fork).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("bounds the source by UTF-8 bytes", () => {
    expect(codeRunInputSchema.safeParse({ ...program(), code: "é".repeat(32_768) }).success).toBe(
      true,
    );

    expect(codeRunInputSchema.safeParse({ ...program(), code: "é".repeat(32_769) }).success).toBe(
      false,
    );
  });
});
