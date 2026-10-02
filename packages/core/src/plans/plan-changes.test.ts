import { interpretPlanEdit } from "@zoonk/ai/tasks/v2/plans/edit-intent";
import { prisma } from "@zoonk/db";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GUEST_OUT_OF_HELP } from "../_test-utils/guest-out-of-help";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { getUsageRule } from "../entitlements/limits";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { proposePlanChange } from "./propose-plan-change";
import { requestPlanEdit } from "./request-plan-edit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/** Grading and plain-words edits claim small AI help, which reads the request for its rate limit. */
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The model call is the one external boundary; each test says what the model understood. */
vi.mock("@zoonk/ai/tasks/v2/plans/edit-intent", () => ({ interpretPlanEdit: vi.fn() }));

/**
 * A Monday in 2020, before the learning events other tests write: estimates read everyone's recent
 * pace, and this keeps it out of the dates these tests expect.
 */
const NOW = new Date("2020-09-28T12:00:00Z");

async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Basics"],
    skills: [
      { area: "Math", lessons: 8 },
      { area: "Biology", lessons: 6 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, library, plan, user };
}

function lastDate(planId: string) {
  return prisma.planItem
    .aggregate({ _max: { scheduledFor: true }, where: { planId } })
    .then((result) => result._max.scheduledFor?.toISOString().slice(0, 10));
}

function mockEdit(data: Awaited<ReturnType<typeof interpretPlanEdit>>["data"]) {
  vi.mocked(interpretPlanEdit).mockResolvedValue({
    data,
    provenance: {
      generatedAt: NOW.toISOString(),
      latencyMs: 1,
      model: "openai/gpt-6-luna",
      promptVersion: "test",
      provider: "openai",
      requestedModel: "openai/gpt-6-luna",
      runId: "run-test",
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

describe("plan changes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies the learner's change, re-plans from today and lets them undo it", async () => {
    const { goal, plan } = await setup();
    const before = await lastDate(plan.id);

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [1, 2] }] },
    });

    expect(result).toMatchObject({
      change: { canUndo: true, kind: "edited", reason: null, source: "learner", status: "applied" },
      status: "applied",
    });

    const moved = await lastDate(plan.id);
    expect(moved && before && moved > before).toBe(true);

    const change = result.status === "applied" ? result.change : null;

    const undone = await decidePlanChange({
      changeId: change?.id ?? "",
      goalId: goal.id,
      input: { status: "undone" },
    });

    expect(undone).toMatchObject({
      change: { canUndo: false, status: "undone" },
      status: "updated",
    });

    await expect(lastDate(plan.id)).resolves.toBe(before);

    const settings = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(settings.settings).toMatchObject({ weekdayMinutes: null });
  });

  it("refuses changes that can't apply and changes to other learners' plans", async () => {
    const { goal } = await setup();

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ areas: ["History"], kind: "focusAreas" }] },
      }),
    ).resolves.toStrictEqual({ error: "unknownArea", status: "invalid" });

    const other = await userFixture();
    mockSession(other.id);

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ kind: "setDailyMinutes", minutes: 30 }] },
      }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });

  it("applies a proposal of one lesson at once and holds a bigger one for the learner's OK", async () => {
    const { goal, library, plan } = await setup();

    const [extra] = await planLibraryFixture({ skills: [{ lessons: 1 }] }).then(
      (more) => more.skills,
    );

    const anchor = library.skills[1]?.id ?? null;

    const small = await proposePlanChange({
      goalId: goal.id,
      operations: [
        {
          kind: "addSkills",
          skills: [
            {
              area: null,
              beforeSkillId: anchor,
              lessons: 1,
              name: "Fractions",
              skillId: extra?.id ?? "",
            },
          ],
        },
      ],
      reason: "I added a short lesson on fractions.",
      source: "mistakes",
    });

    expect(small.status).toBe("applied");

    const big = await proposePlanChange({
      goalId: goal.id,
      operations: [{ kind: "setDailyMinutes", minutes: 5 }],
      reason: "Your evenings are busy, so I made days shorter.",
      source: "memory",
    });

    expect(big.status).toBe("proposed");

    const items = await prisma.planItem.findMany({
      select: { skillId: true },
      where: { planId: plan.id },
    });

    expect(items.map((item) => item.skillId)).toContain(extra?.id);

    const goalBefore = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(goalBefore.dailyMinutes).toBe(12);

    const accepted = await decidePlanChange({
      changeId: "changeId" in big ? big.changeId : "",
      goalId: goal.id,
      input: { status: "applied" },
    });

    expect(accepted).toMatchObject({
      change: {
        canUndo: true,
        reason: "Your evenings are busy, so I made days shorter.",
        status: "applied",
      },
      status: "updated",
    });

    const goalAfter = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(goalAfter.dailyMinutes).toBe(5);

    await expect(
      decidePlanChange({
        changeId: "changeId" in big ? big.changeId : "",
        goalId: goal.id,
        input: { status: "declined" },
      }),
    ).resolves.toStrictEqual({ status: "conflict" });
  });

  it("declines a proposal without touching the plan", async () => {
    const { goal, plan } = await setup();
    const before = await lastDate(plan.id);

    const proposal = await proposePlanChange({
      goalId: goal.id,
      operations: [{ kind: "setDailyMinutes", minutes: 5 }],
      reason: "Shorter days.",
      source: "memory",
    });

    const declined = await decidePlanChange({
      changeId: "changeId" in proposal ? proposal.changeId : "",
      goalId: goal.id,
      input: { status: "declined" },
    });

    expect(declined).toMatchObject({ change: { status: "declined" }, status: "updated" });
    await expect(lastDate(plan.id)).resolves.toBe(before);
  });

  it("only undoes the latest edit", async () => {
    const { goal } = await setup();

    const change = (minutes: number) =>
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ kind: "setDailyMinutes", minutes }] },
      });

    const first = await change(20);
    await change(30);

    await expect(
      decidePlanChange({
        changeId: first.status === "applied" ? (first.change?.id ?? "") : "",
        goalId: goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toStrictEqual({ status: "conflict" });
  });

  it("turns plain words into a proposal the learner can accept", async () => {
    const { goal } = await setup();

    mockEdit({
      operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [0, 6] }],
      summary: "Weekends become rest days.",
      understood: true,
    });

    const result = await requestPlanEdit({
      goalId: goal.id,
      input: { text: "no studying on weekends" },
    });

    expect(result).toMatchObject({
      change: { reason: "Weekends become rest days.", source: "planEdit", status: "proposed" },
      status: "proposed",
    });

    expect(vi.mocked(interpretPlanEdit)).toHaveBeenCalledWith(
      expect.objectContaining({
        areas: ["Math", "Biology"],
        dailyMinutes: 12,
        request: "no studying on weekends",
        today: "2020-09-28",
      }),
    );

    const stored = await prisma.planChange.findFirstOrThrow({
      where: { reason: "Weekends become rest days." },
    });

    expect(stored).toMatchObject({ model: "openai/gpt-6-luna", runId: "run-test" });
  });

  it("asks a guest who used today's help to sign up before reading plain words", async () => {
    const { goal, user } = await setup();

    await usageRecordsFixture({
      count: getUsageRule({ kind: "assist", tier: "guest" }).day ?? 0,
      createdAt: new Date(),
      kind: "assist",
      userId: user.id,
    });

    mockGuestSession(user.id);

    await expect(
      requestPlanEdit({ goalId: goal.id, input: { text: "less on weekends" } }),
    ).resolves.toStrictEqual(GUEST_OUT_OF_HELP);

    expect(interpretPlanEdit).not.toHaveBeenCalled();
  });

  it("says when plain words aren't a plan change", async () => {
    const { goal } = await setup();
    mockEdit({ operations: [], summary: "", understood: false });

    await expect(
      requestPlanEdit({ goalId: goal.id, input: { text: "what is photosynthesis?" } }),
    ).resolves.toStrictEqual({ status: "notUnderstood" });
  });
});
