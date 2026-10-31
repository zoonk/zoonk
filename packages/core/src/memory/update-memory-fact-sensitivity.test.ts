import { gateMemoryFact } from "@zoonk/ai/tasks/memory/gate";
import { prisma } from "@zoonk/db";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
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

  it("throws a failed check, so its step retries, and leaves the flag as it was", async () => {
    const fact = await learnerFact();
    vi.mocked(gateMemoryFact).mockRejectedValue(new Error("Gateway down"));

    await updateMemoryFact({ factId: fact.id, input: { statement: SENSITIVE } });
    const [check] = await owedChecks(fact.userId);

    await expect(check?.()).rejects.toThrow("Gateway down");

    await expect(
      prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } }),
    ).resolves.toMatchObject({ sensitive: false, statement: SENSITIVE });
  });

  it("owes no check when only the category changes", async () => {
    const fact = await learnerFact();

    await updateMemoryFact({ factId: fact.id, input: { category: "routine" } });

    await expect(owedChecks(fact.userId)).resolves.toStrictEqual([]);
  });
});
