import { gateMemoryFact } from "@zoonk/ai/tasks/v2/memory/gate";
import { prisma } from "@zoonk/db";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { logError } from "@zoonk/utils/logger";
import { after } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
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

function deferredChecks() {
  return vi.mocked(after).mock.calls.map(([task]) => task as () => Promise<void>);
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

    const [checkSensitive, checkLatest] = deferredChecks();

    await checkLatest?.();
    await checkSensitive?.();

    await expect(
      prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } }),
    ).resolves.toMatchObject({ sensitive: false, statement: "Likes chess" });
  });

  it("clears the flag once a correction no longer says anything sensitive", async () => {
    const fact = await learnerFact({ sensitive: true });

    await updateMemoryFact({ factId: fact.id, input: { statement: "Likes chess" } });
    await Promise.all(deferredChecks().map((check) => check()));

    await expect(
      prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } }),
    ).resolves.toMatchObject({ sensitive: false, statement: "Likes chess" });
  });

  it("leaves the flag as it was when the check fails", async () => {
    const fact = await learnerFact();
    vi.mocked(gateMemoryFact).mockRejectedValue(new Error("Gateway down"));

    await updateMemoryFact({ factId: fact.id, input: { statement: SENSITIVE } });
    await Promise.all(deferredChecks().map((check) => check()));

    await expect(
      prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } }),
    ).resolves.toMatchObject({ sensitive: false, statement: SENSITIVE });

    expect(logError).toHaveBeenCalledOnce();
  });
});
