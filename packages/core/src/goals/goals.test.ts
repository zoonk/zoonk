import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { createGoals } from "./create-goals";
import { getGoal } from "./get-goal";
import { type GoalDraft } from "./goal-contract";
import { listCurrentUserGoals } from "./list-current-user-goals";

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

  it("gives a language certificate's exam goal the language it tests when onboarding leaves it out", async () => {
    await useLearner();

    const result = await createGoals({
      dailyMinutes: 30,
      goals: [
        draft({
          details: { examName: "DELE B2" },
          kind: "exam",
          prompt: "quero passar no DELE B2",
          title: "Passar no DELE B2",
        }),
      ],
    });

    const goalId = result.status === "created" ? result.goals[0]?.id : "";
    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

    expect(goal.targetLanguage).toBe("es");
  });

  it("gives an exam goal the language its notice says the exam tests, whatever the exam is called", async () => {
    await useLearner({ plus: true });

    const testedLanguage = {
      citation: {
        passage: "PTE Academic is a computer-based academic English test.",
        sourceId: "s",
      },
      language: "en",
    };

    const [pte, ielts] = await Promise.all([
      examBlueprintFixture({
        name: "PTE Academic",
        structure: { formats: [], mock: null, rules: [], subjects: [], testedLanguage },
      }),
      // Read before notices said which language they test: the certificate's name still does.
      examBlueprintFixture({ name: "IELTS Academic" }),
    ]);

    const result = await createGoals({
      dailyMinutes: 30,
      goals: [
        draft({
          examBlueprintId: pte.id,
          kind: "exam",
          prompt: "I need 65 in PTE Academic",
          title: "PTE Academic 65",
        }),
        draft({
          examBlueprintId: ielts.id,
          kind: "exam",
          prompt: "IELTS band 7",
          title: "IELTS Academic band 7",
        }),
      ],
    });

    const ids = result.status === "created" ? result.goals.map((goal) => goal.id) : [];
    const goals = await prisma.goal.findMany({ where: { id: { in: ids } } });

    expect(
      Object.fromEntries(goals.map((goal) => [goal.title, goal.targetLanguage])),
    ).toStrictEqual({ "IELTS Academic band 7": "en", "PTE Academic 65": "en" });
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

  it("places a test days away on its first day while that day's lessons are still being written", async () => {
    const user = await useLearner();
    const goal = await goalFixture({ kind: "exam", userId: user.id });

    const plan = await planFixture({
      goalId: goal.id,
      phases: ["gaps", "practice", "finalStretch"].map((kind, index) => ({
        endDate: null,
        kind,
        name: `Day ${index + 1}`,
      })),
    });

    // Days 1 and 2 are stand-ins for lessons not outlined yet; day 3 is the short mock.
    await Promise.all(
      [0, 0, 1, 1].map((phase, position) =>
        planItemFixture({ phase, planId: plan.id, position, skillId: null }),
      ),
    );

    await planItemFixture({ kind: "mock", phase: 2, planId: plan.id, position: 4 });

    await expect(getGoal(goal.id)).resolves.toMatchObject({ goal: { plan: { currentPhase: 0 } } });
  });

  // Pedro's plan gave a lesson of the second phase before the first phase's last lesson and its
  // challenge: read from the next thing to do, he was in the second phase, and back in the first
  // once a change planned that lesson first.
  it("is in the earliest phase with work left, though a later phase's lesson comes first", async () => {
    const user = await useLearner();
    const goal = await goalFixture({ userId: user.id });

    const plan = await planFixture({
      goalId: goal.id,
      phases: ["Basics", "Projects"].map((name) => ({ endDate: null, kind: "learn", name })),
    });

    await Promise.all(
      [
        { phase: 0, status: "done" as const },
        { phase: 1 },
        { phase: 0 },
        { kind: "boss" as const, phase: 0 },
        { phase: 1 },
      ].map((item, position) =>
        planItemFixture({ ...item, planId: plan.id, position, skillId: null }),
      ),
    );

    await expect(getGoal(goal.id)).resolves.toMatchObject({ goal: { plan: { currentPhase: 0 } } });
  });

  // The goal list counted every lesson not left to do as done, so lessons set aside after missed
  // days read as studied. It counts as the Journey's phases do: lessons studied, of every lesson
  // the plan teaches (a stand-in's saved size) but the ones tested out.
  it("counts the plan's lessons as the Journey does, never a lesson set aside as done", async () => {
    const user = await useLearner();
    const [goal, skill] = await Promise.all([goalFixture({ userId: user.id }), skillFixture()]);

    const plan = await planFixture({
      goalId: goal.id,
      phases: [{ endDate: null, kind: "learn", name: "Basics" }],
    });

    await Promise.all(
      [
        { status: "done" as const },
        { status: "skipped" as const },
        { status: "testedOut" as const },
        { status: "todo" as const },
        { lessons: 3, skillId: skill.id, status: "skipped" as const },
      ].map((item, position) =>
        planItemFixture({ skillId: null, ...item, planId: plan.id, position }),
      ),
    );

    await expect(getGoal(goal.id)).resolves.toMatchObject({
      goal: { plan: { lessonsDone: 1, lessonsTotal: 6 } },
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
