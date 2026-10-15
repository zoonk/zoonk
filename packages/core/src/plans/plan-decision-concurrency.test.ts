import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { isJsonObject } from "@zoonk/utils/json";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { holdLearnerRevision, waitForBlockedStatement } from "../_test-utils/learner-revision";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { parsePlanChangePayload, toPlanChangePayload } from "./_utils/plan-change-payload";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { proposePlanChange } from "./propose-plan-change";

const NOW = new Date("2020-09-28T12:00:00Z");
const pending = new Set<Promise<void>>();

/** A timed-out body must release its row lock before another test changes the clock or actor. */
function runBody(body: () => Promise<void>) {
  const promise = body();
  pending.add(promise);
  return promise.finally(() => pending.delete(promise));
}

/** A rejected sibling must finish before the body releases its clock and authenticated actor. */
async function allAndDrain<const T extends readonly unknown[]>(operations: T) {
  try {
    return await Promise.all(operations);
  } finally {
    await Promise.allSettled(operations);
  }
}

async function setup() {
  const [user, library] = await allAndDrain([
    userFixture(),
    planLibraryFixture({ skills: [{ lessons: 8 }, { lessons: 6 }] }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);
  const day = await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });
  expect(day.status).toBe("ready");

  const proposal = await proposePlanChange({
    goalId: goal.id,
    operations: [{ kind: "setDailyMinutes", minutes: 5 }],
    reason: "Shorter days.",
    source: "memory",
  });

  if (!("changeId" in proposal)) {
    throw new Error(`Expected a waiting proposal, received ${proposal.status}`);
  }

  return { changeId: proposal.changeId, goal, plan, user };
}

async function readPlanAndDay({ changeId, goal, plan }: Awaited<ReturnType<typeof setup>>) {
  const [savedPlan, savedGoal, day, snapshots] = await allAndDrain([
    prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { id: plan.id },
    }),
    prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
    prisma.studySession.findFirstOrThrow({
      include: { blocks: { orderBy: { position: "asc" } } },
      where: { goalId: goal.id, localDate: new Date("2020-09-28T00:00:00Z") },
    }),
    prisma.planChangeSnapshot.findMany({ where: { changeId } }),
  ]);

  return { day, goal: savedGoal, plan: savedPlan, snapshots };
}

describe("plan decisions preserve the first committed answer", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(async () => {
    await Promise.allSettled(pending);
    vi.useRealTimers();
  });

  it("does not apply a proposal declined while Apply was computing", () =>
    runBody(async () => {
      const fixture = await setup();
      const before = await readPlanAndDay(fixture);
      expect(before.day.blocks.length).toBeGreaterThan(0);
      const owner = await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } });

      const held = holdLearnerRevision({
        beforeCommit: (tx) =>
          tx.planChange.update({ data: { status: "declined" }, where: { id: fixture.changeId } }),
        userId: fixture.user.id,
      });

      const pid = await held.pid;

      const applying = decidePlanChange({
        changeId: fixture.changeId,
        goalId: fixture.goal.id,
        input: { status: "applied", timeZone: "UTC" },
      });

      const settled = Promise.allSettled([held.done, applying]);

      try {
        await waitForBlockedStatement(pid, /SELECT id FROM users/u);
      } finally {
        held.release();
        await settled;
      }

      await held.done;
      await expect(applying).resolves.toStrictEqual({ status: "conflict" });
      await expect(readPlanAndDay(fixture)).resolves.toStrictEqual(before);

      await expect(
        prisma.planChange.findUniqueOrThrow({ where: { id: fixture.changeId } }),
      ).resolves.toMatchObject({ status: "declined" });

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } }),
      ).resolves.toMatchObject({ learnerRevision: owner.learnerRevision + 1n });
    }));

  it("marks a decline once without changing plan inputs, and rejects its replay without a write", () =>
    runBody(async () => {
      const fixture = await setup();
      const before = await readPlanAndDay(fixture);
      const owner = await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
      const change = await prisma.planChange.findUniqueOrThrow({ where: { id: fixture.changeId } });

      const decision = {
        changeId: fixture.changeId,
        goalId: fixture.goal.id,
        input: { status: "declined" as const },
      };

      await expect(decidePlanChange(decision)).resolves.toMatchObject({
        change: { status: "declined" },
        status: "updated",
      });

      await expect(readPlanAndDay(fixture)).resolves.toStrictEqual(before);

      const declined = await prisma.planChange.findUniqueOrThrow({
        where: { id: fixture.changeId },
      });

      expect(declined.payload).toStrictEqual(change.payload);

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } }),
      ).resolves.toMatchObject({ learnerRevision: owner.learnerRevision + 1n });

      const replay = await countDatabaseStatements(() => decidePlanChange(decision));
      expect(replay.result).toStrictEqual({ status: "conflict" });
      expect(replay.writes).toBe(0);

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } }),
      ).resolves.toMatchObject({ learnerRevision: owner.learnerRevision + 1n });
    }));

  it("commits only one decline when two taps read the same waiting proposal", () =>
    runBody(async () => {
      const fixture = await setup();
      const before = await readPlanAndDay(fixture);
      const owner = await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } });

      const decision = {
        changeId: fixture.changeId,
        goalId: fixture.goal.id,
        input: { status: "declined" as const },
      };

      const answers = await allAndDrain([decidePlanChange(decision), decidePlanChange(decision)]);

      expect(answers.map((answer) => answer.status).toSorted()).toStrictEqual([
        "conflict",
        "updated",
      ]);

      await expect(readPlanAndDay(fixture)).resolves.toStrictEqual(before);

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } }),
      ).resolves.toMatchObject({ learnerRevision: owner.learnerRevision + 1n });
    }));

  it("marks the first acknowledgment once, preserving its payload and timestamp on duplicate taps", () =>
    runBody(async () => {
      const fixture = await setup();

      await expect(
        decidePlanChange({
          changeId: fixture.changeId,
          goalId: fixture.goal.id,
          input: { status: "applied", timeZone: "UTC" },
        }),
      ).resolves.toMatchObject({ status: "updated" });

      const before = await readPlanAndDay(fixture);
      const owner = await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } });

      const applied = await prisma.planChange.findUniqueOrThrow({
        where: { id: fixture.changeId },
      });

      if (!isJsonObject(applied.payload)) {
        throw new Error("Expected the applied change's object payload");
      }

      const decision = {
        changeId: fixture.changeId,
        goalId: fixture.goal.id,
        input: { status: "seen" as const },
      };

      const answers = await allAndDrain([decidePlanChange(decision), decidePlanChange(decision)]);

      answers.forEach((answer) => {
        expect(answer).toMatchObject({ change: { seen: true }, status: "updated" });
      });

      const seen = await prisma.planChange.findUniqueOrThrow({ where: { id: fixture.changeId } });
      expect(seen.payload).toStrictEqual({ ...applied.payload, seenAt: NOW.toISOString() });
      await expect(readPlanAndDay(fixture)).resolves.toStrictEqual(before);

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } }),
      ).resolves.toMatchObject({ learnerRevision: owner.learnerRevision + 1n });

      vi.setSystemTime(new Date(NOW.getTime() + 1000));
      await expect(decidePlanChange(decision)).resolves.toMatchObject({ status: "updated" });

      await expect(
        prisma.planChange.findUniqueOrThrow({ where: { id: fixture.changeId } }),
      ).resolves.toStrictEqual(seen);

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } }),
      ).resolves.toMatchObject({ learnerRevision: owner.learnerRevision + 1n });
    }));

  it("rolls back a decline whose proposal was declined while it waited for its marker", () =>
    runBody(async () => {
      const fixture = await setup();
      const before = await readPlanAndDay(fixture);
      const owner = await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } });

      const original = await prisma.planChange.findUniqueOrThrow({
        where: { id: fixture.changeId },
      });

      const held = holdLearnerRevision({
        beforeCommit: (tx) =>
          tx.planChange.update({ data: { status: "declined" }, where: { id: fixture.changeId } }),
        userId: fixture.user.id,
      });

      const pid = await held.pid;

      const declining = decidePlanChange({
        changeId: fixture.changeId,
        goalId: fixture.goal.id,
        input: { status: "declined" },
      });

      const settled = Promise.allSettled([held.done, declining]);

      try {
        await waitForBlockedStatement(pid, /UPDATE users SET learner_revision/u);
      } finally {
        held.release();
        await settled;
      }

      await held.done;
      await expect(declining).resolves.toStrictEqual({ status: "conflict" });
      await expect(readPlanAndDay(fixture)).resolves.toStrictEqual(before);

      await expect(
        prisma.planChange.findUniqueOrThrow({ where: { id: fixture.changeId } }),
      ).resolves.toMatchObject({ payload: original.payload, status: "declined" });

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } }),
      ).resolves.toMatchObject({ learnerRevision: owner.learnerRevision + 1n });
    }));

  it("keeps an acknowledgment committed while it waited for its marker", () =>
    runBody(async () => {
      const fixture = await setup();

      await expect(
        decidePlanChange({
          changeId: fixture.changeId,
          goalId: fixture.goal.id,
          input: { status: "applied", timeZone: "UTC" },
        }),
      ).resolves.toMatchObject({ status: "updated" });

      const before = await readPlanAndDay(fixture);
      const owner = await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } });

      const current = await prisma.planChange.findUniqueOrThrow({
        where: { id: fixture.changeId },
      });

      const payload = toPlanChangePayload({
        ...parsePlanChangePayload(current.payload),
        seenAt: new Date(NOW.getTime() - 1000).toISOString(),
      });

      const held = holdLearnerRevision({
        beforeCommit: async (tx) => {
          const fresh = await tx.planChange.findUniqueOrThrow({ where: { id: fixture.changeId } });

          await tx.planChange.update({
            data: {
              payload: toPlanChangePayload({
                ...parsePlanChangePayload(fresh.payload),
                seenAt: new Date(NOW.getTime() - 1000).toISOString(),
              }),
            },
            where: { id: fixture.changeId },
          });
        },
        userId: fixture.user.id,
      });

      const pid = await held.pid;

      const seeing = decidePlanChange({
        changeId: fixture.changeId,
        goalId: fixture.goal.id,
        input: { status: "seen" },
      });

      const settled = Promise.allSettled([held.done, seeing]);

      try {
        await waitForBlockedStatement(pid, /UPDATE users SET learner_revision/u);
      } finally {
        held.release();
        await settled;
      }

      await held.done;

      await expect(seeing).resolves.toMatchObject({
        change: { seen: true, status: "applied" },
        status: "updated",
      });

      await expect(
        prisma.planChange.findUniqueOrThrow({ where: { id: fixture.changeId } }),
      ).resolves.toMatchObject({ payload });

      await expect(readPlanAndDay(fixture)).resolves.toStrictEqual(before);

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } }),
      ).resolves.toMatchObject({ learnerRevision: owner.learnerRevision + 1n });
    }));
});
