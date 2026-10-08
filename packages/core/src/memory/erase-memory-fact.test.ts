import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getMemoryCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { eraseMemoryFactForSupport } from "./erase-memory-fact";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

function mockAdminSession(userId: string) {
  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only the identity and role are read.
    { user: { id: userId, role: "admin" } } as Awaited<ReturnType<typeof getSession>>,
  );
}

describe(eraseMemoryFactForSupport, () => {
  it("removes the fact and the facts it replaced for good, leaving the learner's other facts", async () => {
    const [admin, learner] = await Promise.all([userFixture({ role: "admin" }), userFixture()]);

    const [fact, otherFact] = await Promise.all([
      memoryFactFixture({ statement: "Wants Law", userId: learner.id }),
      memoryFactFixture({ statement: "Studies at night", userId: learner.id }),
    ]);

    const replaced = await memoryFactFixture({
      statement: "Wants Medicine",
      status: "superseded",
      supersededById: fact.id,
      userId: learner.id,
    });

    mockAdminSession(admin.id);

    await expect(eraseMemoryFactForSupport(fact.id)).resolves.toStrictEqual({
      erased: 2,
      status: "erased",
    });

    const remaining = await prisma.memoryFact.findMany({ where: { userId: learner.id } });

    expect(remaining.map((row) => row.id)).toStrictEqual([otherFact.id]);
    expect(remaining.map((row) => row.id)).not.toContain(replaced.id);
    expect(revalidateTag).toHaveBeenCalledWith(getMemoryCacheTag(learner.id), { expire: 0 });
  });

  it("erases a fact the learner already deleted, with the history deleted with it", async () => {
    const [admin, learner] = await Promise.all([userFixture({ role: "admin" }), userFixture()]);

    const deleted = await memoryFactFixture({
      deletedAt: new Date(),
      status: "deleted",
      userId: learner.id,
    });

    await memoryFactFixture({
      deletedAt: new Date(),
      status: "deleted",
      supersededById: deleted.id,
      userId: learner.id,
    });

    mockAdminSession(admin.id);

    await expect(eraseMemoryFactForSupport(deleted.id)).resolves.toStrictEqual({
      erased: 2,
      status: "erased",
    });

    await expect(prisma.memoryFact.count({ where: { userId: learner.id } })).resolves.toBe(0);
  });

  it("refuses learners and guests, and reports unknown facts", async () => {
    const learner = await userFixture();
    const fact = await memoryFactFixture({ userId: learner.id });

    mockSession(learner.id);

    await expect(eraseMemoryFactForSupport(fact.id)).resolves.toStrictEqual({
      status: "forbidden",
    });

    mockSession(null);

    await expect(eraseMemoryFactForSupport(fact.id)).resolves.toStrictEqual({
      status: "unauthorized",
    });

    const admin = await userFixture({ role: "admin" });
    mockAdminSession(admin.id);

    await expect(eraseMemoryFactForSupport(randomUUID())).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(eraseMemoryFactForSupport("not-a-uuid")).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(prisma.memoryFact.count({ where: { id: fact.id } })).resolves.toBe(1);
  });
});
