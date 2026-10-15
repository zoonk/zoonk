import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  holdLearnerRevision,
  readLearnerRevision,
  waitForBlockedStatement,
} from "../../_test-utils/learner-revision";
import { mockSession } from "../../_test-utils/mock-session";
import { finishGoalPlacement } from "./finish-goal-placement";

async function setup() {
  const user = await userFixture();
  const goal = await goalFixture({ details: { subject: "Physics" }, userId: user.id });
  const plan = await planFixture({ goalId: goal.id });
  mockSession(user.id);
  return { goal, plan, user };
}

async function versions(fixture: Awaited<ReturnType<typeof setup>>) {
  const [revision, plan] = await Promise.all([
    readLearnerRevision(fixture.user.id),
    prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } }),
  ]);

  return { inputVersion: plan.inputVersion, revision };
}

function decline(goalId: string) {
  return finishGoalPlacement({ goalId, input: { fromScratch: true } });
}

describe("declined placement revisions", () => {
  it("marks the choice and plan inputs once, keeping a repeated choice unchanged", async () => {
    const fixture = await setup();
    const before = await versions(fixture);
    await expect(decline(fixture.goal.id)).resolves.toMatchObject({ status: "ready" });

    await expect(
      prisma.goal.findUniqueOrThrow({ where: { id: fixture.goal.id } }),
    ).resolves.toMatchObject({ details: { placementDeclined: true, subject: "Physics" } });

    const changed = { inputVersion: before.inputVersion + 1, revision: before.revision + 1n };
    await expect(versions(fixture)).resolves.toStrictEqual(changed);
    await decline(fixture.goal.id);
    await expect(versions(fixture)).resolves.toStrictEqual(changed);
  });

  it("does not mark a goal the caller does not own", async () => {
    const fixture = await setup();
    const stranger = await userFixture();
    const before = await versions(fixture);
    mockSession(stranger.id);
    await expect(decline(fixture.goal.id)).resolves.toStrictEqual({ status: "notFound" });
    await expect(versions(fixture)).resolves.toStrictEqual(before);
    await expect(readLearnerRevision(stranger.id)).resolves.toBe(0n);
  });

  it("reads the current details after the marker and commits one choice in a race", async () => {
    const fixture = await setup();
    const before = await versions(fixture);

    const holder = holdLearnerRevision({
      beforeCommit: (tx) =>
        tx.goal.update({
          data: { details: { subject: "Physics", updatedBeforeDecline: true } },
          where: { id: fixture.goal.id },
        }),
      userId: fixture.user.id,
    });

    const pid = await holder.pid;
    const declines = Promise.all([decline(fixture.goal.id), decline(fixture.goal.id)]);

    try {
      await waitForBlockedStatement(pid, /UPDATE users SET learner_revision/u);
    } finally {
      holder.release();
      await Promise.all([holder.done, declines]);
    }

    await expect(versions(fixture)).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 1,
      revision: before.revision + 2n,
    });

    await expect(
      prisma.goal.findUniqueOrThrow({ where: { id: fixture.goal.id } }),
    ).resolves.toMatchObject({
      details: { placementDeclined: true, subject: "Physics", updatedBeforeDecline: true },
    });
  });
});
