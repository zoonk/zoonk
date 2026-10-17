import { prisma } from "@zoonk/db";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { unplannedGoalFixture } from "../../plans/_test-utils/plan-library";
import { settleMissions } from "./settle-missions";

async function setup(pendingMission = false) {
  const user = await userFixture();
  const { goal, plan } = await unplannedGoalFixture({ timezone: "UTC", userId: user.id });

  const session = await studySessionFixture({
    goalId: goal.id,
    missions: {
      picks: [
        { anchor: { blockKind: "practice" }, kind: "practice", total: 1 },
        ...(pendingMission
          ? [{ anchor: { blockKind: "learn" }, kind: "somethingNew", total: 1 }]
          : []),
      ],
      version: 1,
    },
    startedAt: new Date(),
    status: "active",
    userId: user.id,
  });

  const block = await studySessionBlockFixture({
    completedAt: new Date(),
    kind: "practice",
    sessionId: session.id,
    status: "completed",
  });

  if (pendingMission) {
    await studySessionBlockFixture({ kind: "learn", position: 1, sessionId: session.id });
  }

  return {
    plan,
    session,
    user,
    write: () =>
      settleMissions({
        sessionId: session.id,
        source: { id: block.id, kind: "studySessionBlock" },
        timeZone: "UTC",
        userId: user.id,
      }),
  };
}

async function versions({ plan, user }: Awaited<ReturnType<typeof setup>>) {
  const [saved, actor] = await Promise.all([
    prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
    prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
  ]);

  return { inputVersion: saved.inputVersion, learnerRevision: actor.learnerRevision };
}

async function assertMission(day: Awaited<ReturnType<typeof setup>>) {
  await expect(
    prisma.studySession.findUniqueOrThrow({ where: { id: day.session.id } }),
  ).resolves.toMatchObject({
    fullMealAt: expect.any(Date),
    missions: { picks: [expect.objectContaining({ done: 1, kind: "practice", total: 1 })] },
  });

  await expect(
    prisma.userProgress.findUniqueOrThrow({ where: { userId: day.user.id } }),
  ).resolves.toMatchObject({ totalBrainPower: 50n });
}

describe("the mission owning transaction raises the visible revision once", () => {
  it("marks partial progress without paying the completion bonus or changing teaching inputs", async () => {
    const day = await setup(true);
    const before = await versions(day);

    await expect(day.write()).resolves.toMatchObject({ fullMealPaid: false });
    const changed = { ...before, learnerRevision: before.learnerRevision + 1n };
    await expect(versions(day)).resolves.toStrictEqual(changed);

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: day.session.id } }),
    ).resolves.toMatchObject({
      fullMealAt: null,
      missions: {
        picks: [expect.objectContaining({ done: 1 }), expect.objectContaining({ total: 1 })],
      },
    });

    await expect(day.write()).resolves.toMatchObject({ fullMealPaid: false });
    await expect(versions(day)).resolves.toStrictEqual(changed);
  });

  it("pays and marks new mission progress, while a replay changes neither", async () => {
    const day = await setup();
    const before = await versions(day);
    await expect(day.write()).resolves.toMatchObject({ fullMealPaid: true });
    await assertMission(day);
    const changed = { ...before, learnerRevision: before.learnerRevision + 1n };
    await expect(versions(day)).resolves.toStrictEqual(changed);
    await expect(day.write()).resolves.toMatchObject({ fullMealPaid: false });
    await expect(versions(day)).resolves.toStrictEqual(changed);
    await assertMission(day);
  });

  it("two completing activities commit one reward and one revision", async () => {
    const day = await setup();
    const before = await versions(day);
    const results = await Promise.all([day.write(), day.write()]);
    expect(results.filter((result) => result.fullMealPaid)).toHaveLength(1);
    await assertMission(day);

    await expect(versions(day)).resolves.toStrictEqual({
      ...before,
      learnerRevision: before.learnerRevision + 1n,
    });
  });
});
