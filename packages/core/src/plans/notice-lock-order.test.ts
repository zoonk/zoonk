import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { recordGoalGeneration } from "../goals/record-goal-generation";
import { markPlanWrite } from "./_utils/mark-plan-write";
import { startNoticeWait } from "./notice-wait";

const NOW = new Date("2026-10-15T12:00:00Z");
const WAIT_MS = 360_000;

async function setup() {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });
  const plan = await planFixture({ goalId: goal.id });
  return { goal, plan, user };
}

async function waitForBlockedBy(holderPid: number) {
  await vi.waitFor(async () => {
    const [waiting] = await prisma.$queryRaw<{ blocked: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity
        WHERE datname = current_database() AND ${holderPid} = ANY(pg_blocking_pids(pid))
      ) AS blocked
    `;

    expect(waiting?.blocked).toBe(true);
  });
}

async function readRevision(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return user.learnerRevision;
}

describe("revision-only notice writes with the planner", () => {
  it.each([1, 2, 3, 4, 5])(
    "completes both writes when the planner holds the plan first (run %i)",
    async () => {
      const { goal, plan, user } = await setup();
      const held = Promise.withResolvers<number>();
      const release = Promise.withResolvers<null>();

      const planning = prisma.$transaction(async (tx) => {
        // Pause at the planner's first lock, before it takes the learner marker.
        await tx.$queryRaw`SELECT id FROM plans WHERE id = ${plan.id}::uuid FOR UPDATE`;
        const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        held.resolve(backend?.pid ?? 0);
        await release.promise;

        await markPlanWrite(tx, plan);

        return tx.plan.update({
          data: { estimateHours: 42, version: { increment: 1 } },
          where: { id: plan.id },
        });
      });

      const holderPid = await held.promise;
      const notice = startNoticeWait({ goalId: goal.id, now: NOW });
      const settled = Promise.allSettled([planning, notice]);

      try {
        await waitForBlockedBy(holderPid);
      } finally {
        release.resolve(null);
        await settled;
      }

      const outcomes = await settled;
      expect(outcomes.filter((outcome) => outcome.status === "rejected")).toStrictEqual([]);

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      ).resolves.toMatchObject({
        estimateHours: 42,
        inputVersion: plan.inputVersion + 1,
        noticeWaitUntil: new Date(NOW.getTime() + WAIT_MS),
        version: plan.version + 1,
      });

      await expect(readRevision(user.id)).resolves.toBe(user.learnerRevision + 2n);

      // A repeated notice transition cannot retain either a revision or input-version bump.
      await startNoticeWait({ goalId: goal.id, now: NOW });
      await expect(readRevision(user.id)).resolves.toBe(user.learnerRevision + 2n);

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      ).resolves.toMatchObject({ inputVersion: plan.inputVersion + 1 });
    },
  );

  it.each([1, 2, 3, 4, 5])(
    "completes both writes when the notice reaches the learner lock first (run %i)",
    async () => {
      const { goal, plan, user } = await setup();
      const held = Promise.withResolvers<number>();
      const release = Promise.withResolvers<null>();

      const holder = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
        const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        held.resolve(backend?.pid ?? 0);
        await release.promise;
      });

      const holderPid = await held.promise;
      const notice = startNoticeWait({ goalId: goal.id, now: NOW });

      try {
        await waitForBlockedBy(holderPid);

        const planning = prisma.$transaction(async (tx) => {
          await markPlanWrite(tx, plan);

          return tx.plan.update({
            data: { estimateHours: 42, version: { increment: 1 } },
            where: { id: plan.id },
          });
        });

        const settled = Promise.allSettled([planning, notice]);
        release.resolve(null);
        const outcomes = await settled;
        expect(outcomes.filter((outcome) => outcome.status === "rejected")).toStrictEqual([]);
      } finally {
        release.resolve(null);
        await holder;
        await notice;
      }

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      ).resolves.toMatchObject({
        estimateHours: 42,
        inputVersion: plan.inputVersion + 1,
        noticeWaitUntil: new Date(NOW.getTime() + WAIT_MS),
        version: plan.version + 1,
      });

      await expect(readRevision(user.id)).resolves.toBe(user.learnerRevision + 2n);
    },
  );

  it("leaves a replacement plan untouched when a notice loses its original plan lock", async () => {
    const { goal, plan, user } = await setup();
    const held = Promise.withResolvers<number>();
    const replace = Promise.withResolvers<null>();

    const holder = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM plans WHERE id = ${plan.id}::uuid FOR UPDATE`;
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      held.resolve(backend?.pid ?? 0);
      await replace.promise;
      await tx.plan.delete({ where: { id: plan.id } });
      return tx.plan.create({ data: { goalId: goal.id } });
    });

    const holderPid = await held.promise;
    const notice = startNoticeWait({ goalId: goal.id, now: NOW });
    const settled = Promise.allSettled([holder, notice]);

    try {
      await waitForBlockedBy(holderPid);
    } finally {
      replace.resolve(null);
      await settled;
    }

    const replacement = await holder;
    await notice;

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: replacement.id } }),
    ).resolves.toMatchObject({ inputVersion: 0, noticeWaitUntil: null });

    await expect(readRevision(user.id)).resolves.toBe(user.learnerRevision);
  });

  it("records a run without clearing a replacement plan's newer failure", async () => {
    const { goal, plan, user } = await setup();
    const held = Promise.withResolvers<number>();
    const replace = Promise.withResolvers<null>();

    const holder = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM plans WHERE id = ${plan.id}::uuid FOR UPDATE`;
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      held.resolve(backend?.pid ?? 0);
      await replace.promise;
      await tx.plan.delete({ where: { id: plan.id } });
      return tx.plan.create({ data: { buildFailedAt: NOW, goalId: goal.id } });
    });

    const holderPid = await held.promise;
    const generationId = crypto.randomUUID();
    const writing = recordGoalGeneration({ generationId, goalId: goal.id });
    const settled = Promise.allSettled([holder, writing]);

    try {
      await waitForBlockedBy(holderPid);
    } finally {
      replace.resolve(null);
      await settled;
    }

    const replacement = await holder;
    await writing;

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: replacement.id } }),
    ).resolves.toMatchObject({ buildFailedAt: NOW, inputVersion: 0 });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      generationRunId: generationId,
    });

    await expect(readRevision(user.id)).resolves.toBe(user.learnerRevision + 1n);
  });
});
