import { gateMemoryFact } from "@zoonk/ai/tasks/v2/memory/gate";
import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { logError } from "@zoonk/utils/logger";
import { after } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { updateMemoryFact } from "./update-memory-fact";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

// The sensitivity check is a paid model call; its behavior is covered by the memory-gate eval.
vi.mock("@zoonk/ai/tasks/v2/memory/gate", () => ({ gateMemoryFact: vi.fn() }));

// A failed check is logged, not surfaced; the test reads the log instead of printing it.
vi.mock("@zoonk/utils/logger", () => ({ logError: vi.fn(), logWarning: vi.fn() }));

const SENSITIVE = "Has diabetes";

type Gate = Awaited<ReturnType<typeof gateMemoryFact>>;

/** The gate calls a wording sensitive when it's the health detail above. */
function mockGate() {
  vi.mocked(gateMemoryFact).mockImplementation(
    async ({ candidate }) =>
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The capability reads only the gate's decision.
      ({ decision: "keep", sensitive: candidate.statement === SENSITIVE }) as Gate,
  );
}

/** Each deferred check, in the order the corrections scheduled them. */
function deferredChecks() {
  return vi.mocked(after).mock.calls.map(([task]) => task as () => Promise<void>);
}

async function adultFact({ sensitive = false }: { sensitive?: boolean } = {}) {
  const user = await userFixture();

  const [fact] = await Promise.all([
    memoryFactFixture({
      category: "background",
      sensitive,
      statement: "Works nights",
      userId: user.id,
    }),
    learningProfileFixture({ birthMonth: 5, birthYear: 1990, userId: user.id }),
  ]);

  mockSession(user.id);
  return fact;
}

describe("sensitivity of a corrected fact", () => {
  beforeEach(() => {
    mockGate();
  });

  it("keeps the flag on the wording it checked, so a newer correction wins", async () => {
    const fact = await adultFact();

    await updateMemoryFact({ factId: fact.id, input: { statement: SENSITIVE } });
    await updateMemoryFact({ factId: fact.id, input: { statement: "Likes chess" } });

    const [checkSensitive, checkLatest] = deferredChecks();

    // The newer wording's check finishes first; the older one lands after it.
    await checkLatest?.();
    await checkSensitive?.();

    await expect(
      prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } }),
    ).resolves.toMatchObject({ sensitive: false, statement: "Likes chess" });
  });

  it("clears the flag once a correction no longer says anything sensitive", async () => {
    const fact = await adultFact({ sensitive: true });

    await updateMemoryFact({ factId: fact.id, input: { statement: "Likes chess" } });
    await Promise.all(deferredChecks().map((check) => check()));

    await expect(
      prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } }),
    ).resolves.toMatchObject({ sensitive: false, statement: "Likes chess" });
  });

  it("leaves the flag as it was when the check fails", async () => {
    const fact = await adultFact();
    vi.mocked(gateMemoryFact).mockRejectedValue(new Error("Gateway down"));

    await updateMemoryFact({ factId: fact.id, input: { statement: SENSITIVE } });
    await Promise.all(deferredChecks().map((check) => check()));

    await expect(
      prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } }),
    ).resolves.toMatchObject({ sensitive: false, statement: SENSITIVE });

    expect(logError).toHaveBeenCalledOnce();
  });
});
