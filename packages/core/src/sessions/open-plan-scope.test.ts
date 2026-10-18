import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { openStudyDay } from "./open-study-day";

const NOW = new Date("2026-09-30T12:00:00Z");

async function goalFor({ kind, userId }: { kind: "exam" | "learn"; userId: string }) {
  const library = await planLibraryFixture({ skills: [{ lessons: 4 }, { lessons: 4 }] });

  const fixture = await unplannedGoalFixture({
    dailyMinutes: 30,
    details: { placementDeclined: true },
    kind,
    settings: { startDate: "2026-09-30" },
    targetDate: new Date("2026-10-30"),
    timezone: "UTC",
    userId,
  });

  await createGoalPlan({ goalId: fixture.goal.id, graph: library.graph });
  return fixture;
}

async function readPlan(id: string) {
  return prisma.plan.findUniqueOrThrow({
    include: { items: { orderBy: { position: "asc" } } },
    where: { id },
  });
}

describe("plan-scoped Open marking", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("opening one goal marks only its own held-day inputs and keeps the untouched goal's plan", async () => {
    const user = await userFixture();
    const exam = await goalFor({ kind: "exam", userId: user.id });
    const learn = await goalFor({ kind: "learn", userId: user.id });
    mockSession(user.id);

    const [beforeExam, beforeLearn, beforeUser] = await Promise.all([
      readPlan(exam.plan.id),
      readPlan(learn.plan.id),
      prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
    ]);

    const input = { shownDate: "2026-09-30", timeZone: "UTC" };

    await expect(openStudyDay({ ...input, goalId: exam.goal.id })).resolves.toMatchObject({
      status: "opened",
    });

    await expect(readPlan(learn.plan.id)).resolves.toStrictEqual(beforeLearn);

    await expect(readPlan(exam.plan.id)).resolves.toMatchObject({
      inputVersion: beforeExam.inputVersion + 1,
      version: beforeExam.version,
    });

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
      learnerRevision: beforeUser.learnerRevision + 1n,
    });

    await expect(openStudyDay({ ...input, goalId: learn.goal.id })).resolves.toMatchObject({
      status: "opened",
    });

    await expect(readPlan(learn.plan.id)).resolves.toMatchObject({
      inputVersion: beforeLearn.inputVersion + 1,
      items: beforeLearn.items,
      version: beforeLearn.version,
    });

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
      learnerRevision: beforeUser.learnerRevision + 2n,
    });
  });
});
