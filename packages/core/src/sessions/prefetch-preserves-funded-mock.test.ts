import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { getChallenge } from "../checkpoints/get-challenge";
import { unfundableMockMoveFixture } from "../plans/_test-utils/unfundable-mock-move";
import { getPlanTabView } from "../view-models/plan/get-plan-view";
import { getTodayView } from "../view-models/today/get-today-view";
import { getSessionPageView } from "./get-session-page-view";

async function setup() {
  freezeClock();
  vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));
  const user = await userFixture();
  const day = await unfundableMockMoveFixture(user.id);
  await learningProfileFixture({ activeGoalId: day.goal.id, userId: user.id });
  mockSession(user.id);
  return { ...day, user };
}

async function readState(day: Awaited<ReturnType<typeof setup>>) {
  const [actor, profile, plan, sessions, ledger, progress] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: day.user.id } }),
    prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: day.user.id } }),
    prisma.plan.findUniqueOrThrow({
      include: {
        changes: { orderBy: { id: "asc" } },
        goal: true,
        items: { orderBy: [{ position: "asc" }, { id: "asc" }] },
      },
      where: { id: day.plan.id },
    }),
    prisma.studySession.findMany({
      include: { blocks: { orderBy: { position: "asc" } } },
      orderBy: { id: "asc" },
      where: { userId: day.user.id },
    }),
    prisma.learningEvent.findMany({ orderBy: { id: "asc" }, where: { userId: day.user.id } }),
    prisma.dailyProgress.findMany({ orderBy: { id: "asc" }, where: { userId: day.user.id } }),
  ]);

  return { actor, ledger, plan, profile, progress, sessions };
}

function readers(day: Awaited<ReturnType<typeof setup>>) {
  return [
    {
      kind: "mock intro",
      read: () => getChallenge({ input: { timeZone: "UTC" }, planItemId: day.mock.id }),
    },
    { kind: "Today", read: () => getTodayView({ goalId: day.goal.id, timeZone: "UTC" }) },
    { kind: "Plan", read: () => getPlanTabView({ goalId: day.goal.id }) },
  ];
}

describe("mock intro and tab prefetches retain the announced plan", () => {
  it("each real read leaves the saved mock, credit, notices and day untouched", async () => {
    const day = await setup();
    const before = await readState(day);
    expect(before.sessions).toStrictEqual([]);
    expect(before.plan.items.filter((item) => item.kind === "mock")).toStrictEqual([day.mock]);

    await Promise.all(
      readers(day).map(async ({ kind, read }) => {
        const counts = await countDatabaseStatements<{ status: string }>(read);
        expect(counts.result.status).toBe("ready");
        expect(counts.writes, `${kind}: ${counts.statements} statements`).toBe(0);
      }),
    );

    await expect(readState(day)).resolves.toStrictEqual(before);

    await expect(
      getChallenge({ input: { timeZone: "UTC" }, planItemId: day.mock.id }),
    ).resolves.toMatchObject({ challenge: { planItemId: day.mock.id }, status: "ready" });
  });

  it("repeated Today and session-entry reads never open or refresh the day", async () => {
    const day = await setup();
    const before = await readState(day);

    await expect(getTodayView({ goalId: day.goal.id, timeZone: "UTC" })).resolves.toMatchObject({
      status: "ready",
    });

    await expect(readState(day)).resolves.toStrictEqual(before);

    const entry = await countDatabaseStatements(() =>
      getSessionPageView({ goalId: day.goal.id, timeZone: "UTC" }),
    );

    expect(entry.writes).toBe(0);
    expect(entry.result).toMatchObject({ goal: { id: day.goal.id }, status: "unstarted" });

    await expect(getTodayView({ goalId: day.goal.id, timeZone: "UTC" })).resolves.toMatchObject({
      status: "ready",
    });

    await expect(readState(day)).resolves.toStrictEqual(before);
  });
});
