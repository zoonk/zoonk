import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getMemoryCacheTag } from "../cache/tags";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { getSession } from "../users/get-session";
import { eraseMemoryFactForSupport } from "./erase-memory-fact";

async function writeExampleLine(userId: string) {
  const lesson = await libraryLessonFixture();
  const step = await libraryStepFixture({ lessonId: lesson.id });

  return prisma.stepExampleLine.create({
    data: {
      contextKey: "memory-erasure-test",
      model: "test-model",
      promptVersion: "test",
      runId: randomUUID(),
      stepId: step.id,
      text: "An example written from the learner's memory",
      userId,
    },
  });
}

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
    const line = await writeExampleLine(learner.id);

    await expect(eraseMemoryFactForSupport(fact.id)).resolves.toStrictEqual({
      erased: 2,
      status: "erased",
    });

    const remaining = await prisma.memoryFact.findMany({ where: { userId: learner.id } });

    expect(remaining.map((row) => row.id)).toStrictEqual([otherFact.id]);
    expect(remaining.map((row) => row.id)).not.toContain(replaced.id);
    expect(revalidateTag).toHaveBeenCalledWith(getMemoryCacheTag(learner.id), { expire: 0 });

    await expect(prisma.stepExampleLine.findUnique({ where: { id: line.id } })).resolves.toBeNull();
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

  it.each([
    { kind: "erase", lineCount: 1, result: { status: "notFound" } },
    { kind: "delete", lineCount: 0, result: { erased: 2, status: "erased" } },
  ])(
    "uses the current history after a concurrent $kind while its learner lock waits",
    async ({ kind, lineCount, result }) => {
      const [admin, learner] = await Promise.all([userFixture({ role: "admin" }), userFixture()]);
      const fact = await memoryFactFixture({ userId: learner.id });

      const history = await memoryFactFixture({
        status: "superseded",
        supersededById: fact.id,
        userId: learner.id,
      });

      const line = await writeExampleLine(learner.id);
      mockAdminSession(admin.id);
      const locked = Promise.withResolvers<number>();
      const resume = Promise.withResolvers<null>();

      const first = prisma.$transaction(async (transaction) => {
        await markLearnerChanged(transaction, { planInputs: true, userId: learner.id });

        const [backend] = await transaction.$queryRaw<{ pid: number }[]>`
          SELECT pg_backend_pid() AS pid
        `;

        locked.resolve(backend?.pid ?? 0);
        await resume.promise;

        if (kind === "erase") {
          await transaction.memoryFact.deleteMany({ where: { id: { in: [fact.id, history.id] } } });
        } else {
          await transaction.memoryFact.updateMany({
            data: { deletedAt: new Date(), status: "deleted" },
            where: { id: { in: [fact.id, history.id] } },
          });
        }
      });

      let settled: Promise<unknown> = Promise.allSettled([first]);
      let erase: ReturnType<typeof eraseMemoryFactForSupport> | undefined;

      void first.catch((error: unknown) => locked.reject(error));

      try {
        const pid = await locked.promise;
        erase = eraseMemoryFactForSupport(fact.id);
        settled = Promise.allSettled([first, erase]);

        await vi.waitFor(async () => {
          const [waiting] = await prisma.$queryRaw<{ blocked: boolean }[]>`
            SELECT EXISTS (
              SELECT 1 FROM pg_stat_activity AS backend
              WHERE ${pid}::int = ANY(pg_blocking_pids(backend.pid))
            ) AS blocked
          `;

          expect(waiting?.blocked).toBe(true);
        });
      } finally {
        resume.resolve(null);
        await settled;
      }

      await expect(first).resolves.toBeUndefined();
      await expect(erase).resolves.toStrictEqual(result);

      await expect(prisma.stepExampleLine.count({ where: { id: line.id } })).resolves.toBe(
        lineCount,
      );

      const tags = kind === "erase" ? [] : [[getMemoryCacheTag(learner.id), { expire: 0 }]];
      expect(vi.mocked(revalidateTag).mock.calls).toStrictEqual(tags);

      await expect(
        prisma.memoryFact.count({ where: { id: { in: [fact.id, history.id] } } }),
      ).resolves.toBe(0);
    },
  );

  it("refuses learners and absent sessions, and reports unknown facts", async () => {
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
