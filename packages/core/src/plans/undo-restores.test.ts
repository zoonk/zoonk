import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { runSimLife } from "./_test-utils/sim/sim-life";
import { type SimLife } from "./_test-utils/sim/sim-life-plan";
import { toPlanChangePayload } from "./_utils/plan-change-payload";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

const MINUTE = 60_000;
const DAY = 86_400_000;

/** A Monday in 2020, before the learning events other tests write, which estimates read. */
const NOW = new Date("2020-09-28T12:00:00Z");

/** The plan as the learner sees it: its phases, and its items in order with their day and status. */
async function readPlan(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({
    include: { items: { orderBy: { position: "asc" } } },
    where: { id: planId },
  });

  return {
    items: plan.items.map((item) => ({
      kind: item.kind,
      lessonId: item.lessonId,
      scheduledFor: item.scheduledFor?.toISOString().slice(0, 10),
      skillId: item.skillId,
      status: item.status,
    })),
    phases: plan.phases,
  };
}

function twoDaysLater(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + 2 * DAY).toISOString().slice(0, 10);
}

async function findViolations(life: SimLife) {
  const { violations } = await runSimLife(life);
  return violations.filter((violation) => violation.rule === "R38");
}

describe("undo gives back the plan the learner had", () => {
  // Career seed 1005: a light week, then undo, moved 243 items and every phase end.
  it(
    "puts back a career plan's days and phase ends after a light week",
    async () => {
      const life: SimLife = {
        dailyMinutes: 15,
        fixture: "career",
        knownAreas: [],
        pending: [],
        seed: 1005,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 1, kind: "study", misses: [] },
          { kind: "change", spec: { inDays: 18, kind: "lightWeek" }, undo: true, via: "editor" },
        ],
        subscribed: false,
        targetInDays: 152,
      };

      await expect(findViolations(life)).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // Language seed 1005: the same undo moved the first phase's end a day and its challenge.
  it(
    "puts back a language plan's first phase end after a light week",
    async () => {
      const life: SimLife = {
        dailyMinutes: 25,
        fixture: "language",
        knownAreas: [],
        pending: [],
        seed: 1005,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 1, kind: "study", misses: [] },
          { kind: "change", spec: { inDays: 18, kind: "lightWeek" }, undo: true, via: "editor" },
        ],
        subscribed: false,
        targetInDays: 117,
      };

      await expect(findViolations(life)).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // IELTS seed 1018: after placement, 60 minutes down to 45 and undone at once moved three lessons.
  it(
    "puts back an IELTS plan after a time change undone at once",
    async () => {
      const life: SimLife = {
        dailyMinutes: 60,
        fixture: "ielts",
        knownAreas: [],
        pending: [0, 2],
        proposals: "apply",
        seed: 1018,
        speed: 1,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [0, true],
              [2, true],
              [3, false],
              [0, true],
              [3, true],
              [1, true],
              [2, false],
            ],
            kind: "placement",
          },
          { kind: "change", spec: { kind: "time", minutes: 45 }, undo: true, via: "editor" },
        ],
        subscribed: false,
        targetInDays: 25,
      };

      await expect(findViolations(life)).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // Class test seed 1002: undoing placement's test-outs left the skipped lessons as todo rows on
  // day one, beside the lessons the plan laid out without them.
  it(
    "puts back the lessons placement skipped where they were",
    async () => {
      const life: SimLife = {
        dailyMinutes: 20,
        fixture: "class-test",
        knownAreas: [],
        pending: [],
        seed: 1002,
        speed: 1,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [3, false],
              [3, true],
              [4, true],
              [0, false],
            ],
            kind: "placement",
            undo: true,
          },
        ],
        subscribed: false,
        targetInDays: 4,
      };

      await expect(findViolations(life)).resolves.toStrictEqual([]);
    },
    5 * MINUTE,
  );
});

describe("undoing a change in the app", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("puts back the phase end and the days an earlier run kept, not a plan made again", async () => {
    const user = await userFixture();

    const library = await planLibraryFixture({
      phases: ["Basics", "Next steps"],
      skills: [
        { area: "Math", lessons: 6 },
        { area: "Math", lessons: 6, phase: 1 },
      ],
    });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    // The first phase ends two days after its lessons do, as a run that kept the end the learner
    // saw leaves it: its challenge is on that day, and the next phase starts after it.
    const created = await prisma.plan.findUniqueOrThrow({
      include: { items: true },
      where: { id: plan.id },
    });

    const [first, second] = created.phases as { endDate: string; startDate: string }[];

    await prisma.plan.update({
      data: {
        phases: [
          { ...first, endDate: twoDaysLater(first?.endDate ?? "") },
          { ...second, startDate: twoDaysLater(second?.startDate ?? "") },
        ],
      },
      where: { id: plan.id },
    });

    const challenge = created.items.find((item) => item.kind === "boss" && item.phase === 0);

    await prisma.planItem.update({
      data: { scheduledFor: new Date(`${twoDaysLater(first?.endDate ?? "")}T00:00:00Z`) },
      where: { id: challenge?.id ?? "" },
    });

    const shown = await readPlan(plan.id);

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 20 }] },
    });

    const change = result.status === "applied" ? result.change : null;
    await expect(readPlan(plan.id)).resolves.not.toStrictEqual(shown);

    await expect(
      decidePlanChange({
        changeId: change?.id ?? "",
        goalId: goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toMatchObject({ change: { status: "undone" }, status: "updated" });

    await expect(readPlan(plan.id)).resolves.toStrictEqual(shown);
  });

  // Marcos moved his date and undid it: the plan came back, but today's session went from 3
  // activities to 6, with lessons being written. Undo gives back the day the learner had.
  it("gives back today's session as the learner had it", async () => {
    const user = await userFixture();

    const library = await planLibraryFixture({
      phases: ["Basics"],
      skills: [
        { area: "Math", lessons: 8 },
        { area: "Biology", lessons: 0, size: 6 },
      ],
    });

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    const readDay = async () => {
      const day = await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });
      const blocks = day.status === "ready" ? day.session.blocks : [];
      return blocks.map((block) => [block.kind, block.lessonId ?? null]);
    };

    const day = await readDay();

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 30 }] },
    });

    const change = result.status === "applied" ? result.change : null;

    await decidePlanChange({
      changeId: change?.id ?? "",
      goalId: goal.id,
      input: { status: "undone" },
    });

    expect(day.length).toBeGreaterThan(0);
    await expect(readDay()).resolves.toStrictEqual(day);
  });

  // Ana set her time to 15 minutes and back to 45 in the editor: the plan, Today and her subjects'
  // shares came back different from the ones she had. Setting the old value back is Undo.
  it("undoes the latest change when the learner sets back by hand what it changed", async () => {
    const user = await userFixture();

    const library = await planLibraryFixture({
      phases: ["Basics", "Next steps"],
      skills: [
        { area: "Math", lessons: 6 },
        { area: "Math", lessons: 6, phase: 1 },
      ],
    });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);
    const shown = await readPlan(plan.id);

    const changed = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 20 }] },
    });

    const change = changed.status === "applied" ? changed.change : null;

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ kind: "setDailyMinutes", minutes: 12 }] },
      }),
    ).resolves.toMatchObject({ change: { id: change?.id, status: "undone" }, status: "applied" });

    await expect(readPlan(plan.id)).resolves.toStrictEqual(shown);

    await expect(
      prisma.planChange.count({ where: { planId: plan.id, status: "applied" } }),
    ).resolves.toBe(0);
  });

  // Language seed 1054: the learner applied Today's "move phase dates", then picked
  // the practice mix their plan already had. Moving phase dates changes no setting, so the edit
  // read as setting it back, and the dates they had just accepted went back without a word.
  it("never takes an edit that changes nothing as the Undo of a change that set nothing", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ area: "Math", lessons: 4 }] });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);
    const { version } = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    const moved = await planChangeFixture({
      kind: "edited",
      payload: toPlanChangePayload({
        operations: [{ kind: "fitPhaseDates" }],
        source: "learner",
        versionAfter: version,
      }),
      planId: plan.id,
      status: "applied",
    });

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ bias: "balanced", kind: "setPracticeBias" }] },
      }),
    ).resolves.not.toMatchObject({ change: { id: moved.id } });

    await expect(
      prisma.planChange.findUniqueOrThrow({ where: { id: moved.id } }),
    ).resolves.toMatchObject({ status: "applied" });
  });

  it("can't undo once the Library deleted a lesson the plan before had", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ area: "Math", lessons: 4 }] });

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 20 }] },
    });

    const change = result.status === "applied" ? result.change : null;
    await prisma.lesson.delete({ where: { id: library.lessons[0]?.id ?? "" } });

    await expect(
      decidePlanChange({
        changeId: change?.id ?? "",
        goalId: goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toStrictEqual({ status: "conflict" });
  });
});
