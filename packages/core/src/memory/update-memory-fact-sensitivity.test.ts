import { gateMemoryFact } from "@zoonk/ai/tasks/memory/gate";
import { prisma } from "@zoonk/db";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getUsageRule } from "../entitlements/limits";
import { listFollowUps } from "../follow-ups/follow-up-rows";
import { checkFactSensitivity } from "./check-fact-sensitivity";
import { updateMemoryFact } from "./update-memory-fact";

const SENSITIVE = "Has diabetes";

type Gate = Awaited<ReturnType<typeof gateMemoryFact>>;

function mockGate() {
  vi.mocked(gateMemoryFact).mockImplementation(
    async ({ candidate }) =>
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The capability reads only the gate's decision.
      ({ decision: "keep", sensitive: candidate.statement === SENSITIVE }) as Gate,
  );
}

/** The checks the corrections owe, oldest first, as the follow-ups run reads them. */
async function owedChecks(userId: string) {
  const owed = await listFollowUps(userId);

  return owed.flatMap((followUp) =>
    followUp.kind === "checkFactSensitivity" ? [() => checkFactSensitivity(followUp.input)] : [],
  );
}

async function learnerFact({ sensitive = false }: { sensitive?: boolean } = {}) {
  const user = await userFixture();

  const fact = await memoryFactFixture({
    category: "background",
    sensitive,
    statement: "Works nights",
    userId: user.id,
  });

  mockSession(user.id);
  return fact;
}

describe("sensitivity of a corrected fact", () => {
  beforeEach(() => {
    mockGate();
  });

  it("keeps the flag on the wording it checked, so a newer correction wins", async () => {
    const fact = await learnerFact();

    await updateMemoryFact({ factId: fact.id, input: { statement: SENSITIVE } });
    await updateMemoryFact({ factId: fact.id, input: { statement: "Likes chess" } });

    const [checkSensitive, checkLatest] = await owedChecks(fact.userId);

    await checkLatest?.();
    await checkSensitive?.();

    await expect(
      prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } }),
    ).resolves.toMatchObject({ sensitive: false, statement: "Likes chess" });
  });

  it("clears the flag once a correction no longer says anything sensitive", async () => {
    const fact = await learnerFact({ sensitive: true });

    await updateMemoryFact({ factId: fact.id, input: { statement: "Likes chess" } });
    const checks = await owedChecks(fact.userId);
    await Promise.all(checks.map((check) => check()));

    await expect(
      prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } }),
    ).resolves.toMatchObject({ sensitive: false, statement: "Likes chess" });
  });

  it("takes one small AI help for each reworded fact, and none for a new category", async () => {
    const fact = await learnerFact();

    await updateMemoryFact({ factId: fact.id, input: { category: "routine" } });
    await updateMemoryFact({ factId: fact.id, input: { statement: SENSITIVE } });

    await expect(
      prisma.usageRecord.count({ where: { kind: "assist", userId: fact.userId } }),
    ).resolves.toBe(1);
  });

  it("keeps a correction past the learner's small AI help out of use, without a check", async () => {
    const fact = await learnerFact();
    const capped = getUsageRule({ kind: "assist", tier: "free" }).day ?? 0;

    await usageRecordsFixture({
      count: capped,
      createdAt: new Date(),
      kind: "assist",
      userId: fact.userId,
    });

    await expect(
      updateMemoryFact({ factId: fact.id, input: { statement: SENSITIVE } }),
    ).resolves.toMatchObject({ fact: { statement: SENSITIVE }, status: "updated" });

    await expect(
      prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } }),
    ).resolves.toMatchObject({ sensitive: true, statement: SENSITIVE });

    await expect(owedChecks(fact.userId)).resolves.toStrictEqual([]);
  });

  it("throws a failed check, so its step retries, and keeps the correction out of use", async () => {
    const fact = await learnerFact();
    vi.mocked(gateMemoryFact).mockRejectedValue(new Error("Gateway down"));

    await updateMemoryFact({ factId: fact.id, input: { statement: SENSITIVE } });
    const [check] = await owedChecks(fact.userId);

    await expect(check?.()).rejects.toThrow("Gateway down");

    await expect(
      prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } }),
    ).resolves.toMatchObject({ sensitive: true, statement: SENSITIVE });
  });

  it("owes no check when only the category changes", async () => {
    const fact = await learnerFact();

    await updateMemoryFact({ factId: fact.id, input: { category: "routine" } });

    await expect(owedChecks(fact.userId)).resolves.toStrictEqual([]);
  });
});
