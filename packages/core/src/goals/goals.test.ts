import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { createGoals } from "./create-goals";
import { getGoal } from "./get-goal";
import { type GoalDraft } from "./goal-contract";
import { listCurrentUserGoals } from "./list-current-user-goals";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

/**
 * A Monday in 2020, before the learning events other tests write: estimates read everyone's recent
 * pace, and this keeps it out of the dates these tests expect.
 */
const NOW = new Date("2020-09-28T12:00:00Z");

function draft(attrs: Partial<GoalDraft> = {}): GoalDraft {
  return {
    kind: "learn",
    language: "en",
    prompt: "I want to understand AI",
    title: "Understand AI",
    ...attrs,
  };
}

async function useLearner({ plus = false } = {}) {
  const user = await userFixture();

  if (plus) {
    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });
  }

  mockSession(user.id);
  return user;
}

describe(createGoals, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires a signed-in learner", async () => {
    mockSession(null);

    await expect(createGoals({ dailyMinutes: 20, goals: [draft()] })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("creates the goal with an empty plan shaped by the study days, and makes it the main goal", async () => {
    const user = await useLearner();

    const result = await createGoals({
      dailyMinutes: 45,
      goals: [draft({ details: { level: "basic" } })],
      studyDays: [1, 2, 3, 4, 5, 6],
      studyTime: "20:00",
      timeZone: "America/Sao_Paulo",
    });

    expect(result).toMatchObject({
      goals: [
        {
          dailyMinutes: 45,
          details: { level: "basic" },
          isActive: true,
          plan: { lessonsTotal: 0, phaseCount: 0, ready: false },
          studyDays: [1, 2, 3, 4, 5, 6],
          studyTime: "20:00",
        },
      ],
      refused: [],
      status: "created",
    });

    const goalId = result.status === "created" ? result.goals[0]?.id : "";
    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });

    expect(plan.settings).toStrictEqual({
      startDate: "2020-09-28",
      weekdayMinutes: [0, 45, 45, 45, 45, 45, 45],
    });

    const profile = await prisma.userLearningProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });

    expect(profile.activeGoalId).toBe(goalId);
  });

  it("splits one daily budget between two subjects, the first as the main goal", async () => {
    await useLearner({ plus: true });

    const result = await createGoals({
      dailyMinutes: 60,
      goals: [
        draft({ examBlueprintId: undefined, kind: "exam", prompt: "ENEM", title: "ENEM 2026" }),
        draft({ kind: "language", prompt: "English", targetLanguage: "en", title: "English" }),
      ],
    });

    expect(
      result.status === "created" &&
        result.goals.map((goal) => [goal.title, goal.dailyMinutes, goal.isActive]),
    ).toStrictEqual([
      ["ENEM 2026", 40, true],
      ["English", 20, false],
    ]);
  });

  it("creates what the free plan allows and says why the rest wasn't created", async () => {
    await useLearner();

    const result = await createGoals({
      dailyMinutes: 30,
      goals: [draft(), draft({ title: "Chemistry" })],
    });

    expect(result).toMatchObject({
      goals: [{ title: "Understand AI" }],
      refused: [
        { decision: { limit: { resource: "activeGoals" }, status: "limitReached" }, index: 1 },
      ],
      status: "created",
    });

    await expect(createGoals({ dailyMinutes: 30, goals: [draft()] })).resolves.toMatchObject({
      refused: [{ index: 0 }],
      status: "refused",
    });
  });

  it("refuses an exam or course that doesn't exist or is another learner's", async () => {
    const [other] = await Promise.all([userFixture(), useLearner()]);

    const privateExam = await examBlueprintFixture({
      identityKey: `private:${other.id}:bioquimica-${crypto.randomUUID()}`,
      ownerId: other.id,
      visibility: "private",
    });

    await expect(
      createGoals({
        dailyMinutes: 30,
        goals: [draft({ examBlueprintId: crypto.randomUUID(), kind: "exam" })],
      }),
    ).resolves.toStrictEqual({ status: "invalidReference" });

    await expect(
      createGoals({
        dailyMinutes: 30,
        goals: [draft({ examBlueprintId: privateExam.id, kind: "exam" })],
      }),
    ).resolves.toStrictEqual({ status: "invalidReference" });
  });
});

describe(listCurrentUserGoals, () => {
  beforeEach(() => {
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  it("lists the learner's goals with the day's total and hides archived ones", async () => {
    const user = await useLearner({ plus: true });

    const created = await createGoals({
      dailyMinutes: 55,
      goals: [
        draft({ dailyMinutes: 45, title: "ENEM" }),
        draft({ dailyMinutes: 10 }),
        draft({ dailyMinutes: 15, title: "Old" }),
      ],
    });

    const old = created.status === "created" ? created.goals.at(-1) : undefined;
    await prisma.goal.update({ data: { status: "archived" }, where: { id: old?.id } });

    const list = await listCurrentUserGoals();

    expect(list).toMatchObject({
      dailyMinutes: 55,
      goals: [{ title: "ENEM" }, { title: "Understand AI" }],
    });

    expect(list?.goals).toHaveLength(2);

    mockSession(null);
    await expect(listCurrentUserGoals()).resolves.toBeNull();

    const stranger = await userFixture();
    mockSession(stranger.id);
    await expect(getGoal(old?.id ?? "")).resolves.toStrictEqual({ status: "notFound" });

    mockSession(user.id);

    await expect(getGoal(old?.id ?? "")).resolves.toMatchObject({
      goal: { status: "archived" },
      status: "ready",
    });
  });

  it("leads with the first active goal while none is picked, the goal the tabs show", async () => {
    const user = await useLearner({ plus: true });

    const created = await createGoals({
      dailyMinutes: 40,
      goals: [draft({ title: "ENEM" }), draft({ title: "Chemistry" })],
    });

    const [first] = created.status === "created" ? created.goals : [];

    await Promise.all([
      prisma.goal.update({ data: { status: "paused" }, where: { id: first?.id } }),
      prisma.userLearningProfile.update({
        data: { activeGoalId: null },
        where: { userId: user.id },
      }),
    ]);

    const list = await listCurrentUserGoals();

    expect(list?.goals.map((goal) => [goal.title, goal.isActive])).toStrictEqual([
      ["Chemistry", true],
      ["ENEM", false],
    ]);

    expect(list?.activeGoalId).toBe(list?.goals[0]?.id);
  });
});
