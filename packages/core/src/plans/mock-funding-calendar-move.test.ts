import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getChallenge } from "../checkpoints/get-challenge";
import { moveChallenge } from "../checkpoints/move-challenge";
import { getMock } from "../exams/mocks/get-mock";
import { mockConditionsSchema } from "../exams/mocks/mock-contract";
import { startMock } from "../exams/mocks/start-mock";
import { examStructureSchema } from "../library/exams/blueprint-contract";
import { getTodayView } from "../view-models/today/get-today-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { parsePlanPhases, parsePlanSettings } from "./planner/plan-state";

const START = "2020-09-28";
const CHANGE_DAY = "2020-10-05";
const ORIGINAL_MOCK = "2020-10-09";
const SUNDAY_MOCK = "2020-10-11";
const FINAL_MOCK = "2020-10-12";

const STRUCTURE = examStructureSchema.parse({
  formats: [],
  mock: {
    citations: [],
    order: null,
    scoring: { description: "Each correct answer earns one point", method: "raw" },
    sections: [{ day: 1, minutes: 330, name: "Math", questions: 60 }],
    timeLimitMinutes: 330,
    totalQuestions: 60,
  },
  rules: [],
  subjects: [],
});

const TWO_DAY_STRUCTURE = examStructureSchema.parse({
  ...STRUCTURE,
  mock: {
    ...STRUCTURE.mock,
    sections: [
      { day: 1, minutes: 330, name: "Languages", questions: 60 },
      { day: 2, minutes: 300, name: "Math", questions: 60 },
    ],
    timeLimitMinutes: 630,
    totalQuestions: 120,
  },
});

/** Enough real written work keeps the first funded mock inside the undated plan. */
async function setup({
  dailyMinutes = 30,
  targetDate = null,
  twoDays = false,
}: { dailyMinutes?: number; targetDate?: Date | null; twoDays?: boolean } = {}) {
  const [user, blueprint, library] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure: twoDays ? TWO_DAY_STRUCTURE : STRUCTURE }),
    planLibraryFixture({
      skills: twoDays
        ? [
            { area: "Languages", lessons: 30 },
            { area: "Math", lessons: 30 },
          ]
        : [{ area: "Math", lessons: 60 }],
    }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: new Date(START),
    dailyMinutes,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: {
      startDate: START,
      weekdayMinutes: [0, dailyMinutes, dailyMinutes, dailyMinutes, dailyMinutes, dailyMinutes, 0],
    },
    targetDate,
    timezone: "UTC",
    userId: user.id,
  });

  await prisma.subscription.create({
    data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
  });

  if (twoDays) {
    await prisma.lesson.updateMany({
      data: { estimatedMinutes: 60 },
      where: { id: { in: library.lessons.map((lesson) => lesson.id) } },
    });
  }

  await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toMatchObject({
    status: "created",
  });

  // Auth is a request/framework boundary; plan persistence and all capability work stay real.
  mockSession(user.id);
  return { blueprint, goal, library, plan, user };
}

async function readSaved(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({
    include: { items: { orderBy: { position: "asc" } } },
    where: { id: planId },
  });

  return { ...plan, settings: parsePlanSettings(plan.settings) };
}

async function readAnnounced({
  date,
  goalId,
  planItemId,
}: {
  date: string;
  goalId: string;
  planItemId: string;
}) {
  vi.setSystemTime(new Date(`${date}T12:00:00Z`).getTime() - 86_400_000);

  const [view, challenge] = await Promise.all([
    getGoalPlan(goalId),
    getChallenge({ input: { timeZone: "UTC" }, planItemId }),
  ]);

  if (view.status !== "ready") {
    throw new Error("Expected the announced mock's Plan");
  }

  return {
    challenge,
    item: view.plan.week.days.flatMap((day) => day.items).find((item) => item.id === planItemId),
  };
}

describe("mock funding through exported calendar and challenge moves", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${START}T12:00:00Z`));
  });

  afterEach(() => vi.useRealTimers());

  it("keeps all 75 past banked minutes when adding Sundays automatically moves Friday's mock", async () => {
    const { goal, plan } = await setup();
    const before = await readSaved(plan.id);
    const funding = before.settings.mockFunding.find((entry) => entry.date === ORIGINAL_MOCK);
    const past = funding?.contributions.filter((entry) => entry.date < CHANGE_DAY);

    expect(before.items).toContainEqual(
      expect.objectContaining({
        kind: "mock",
        scheduledFor: new Date(ORIGINAL_MOCK),
        status: "todo",
      }),
    );

    expect(funding?.minutes).toBe(165);

    expect(past).toStrictEqual([
      { date: "2020-09-28", minutes: 15 },
      { date: "2020-09-29", minutes: 15 },
      { date: "2020-09-30", minutes: 15 },
      { date: "2020-10-01", minutes: 15 },
      { date: "2020-10-02", minutes: 15 },
    ]);

    expect(before.settings.movedEvents).toStrictEqual([]);
    vi.setSystemTime(new Date(`${CHANGE_DAY}T12:00:00Z`));

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: {
          operations: [{ kind: "setWeekdayMinutes", minutes: 30, weekdays: [0] }],
          timeZone: "UTC",
        },
      }),
    ).resolves.toMatchObject({ status: "applied" });

    const after = await readSaved(plan.id);
    const moved = after.settings.mockFunding.find((entry) => entry.date === SUNDAY_MOCK);

    expect(after.settings.movedEvents).toStrictEqual([]);

    expect(after.items).toContainEqual(
      expect.objectContaining({
        kind: "mock",
        scheduledFor: new Date(SUNDAY_MOCK),
        status: "todo",
      }),
    );

    expect(
      after.items.some(
        (item) =>
          item.kind === "mock" && item.scheduledFor?.toISOString().startsWith(ORIGINAL_MOCK),
      ),
    ).toBe(false);

    expect(moved?.minutes).toBe(165);
    expect(moved?.contributions.filter((entry) => entry.date < CHANGE_DAY)).toStrictEqual(past);

    expect(moved?.contributions.filter((entry) => entry.date >= CHANGE_DAY)).toStrictEqual([
      { date: "2020-10-05", minutes: 12 },
      { date: "2020-10-06", minutes: 12 },
      { date: "2020-10-07", minutes: 12 },
      { date: "2020-10-08", minutes: 12 },
      { date: "2020-10-09", minutes: 12 },
    ]);
  });

  it("rejects an unfundable full-clock move with its real duration and no saved changes", async () => {
    const { plan } = await setup({ targetDate: new Date("2020-10-14") });
    const before = await readSaved(plan.id);

    const original = before.items.find(
      (item) => item.kind === "mock" && item.scheduledFor?.toISOString().startsWith(ORIGINAL_MOCK),
    );

    if (!original) {
      throw new Error("Expected the original weekly mock");
    }

    expect(parsePlanPhases(before.phases)).toContainEqual(
      expect.objectContaining({ kind: "finalStretch", startDate: FINAL_MOCK }),
    );

    await expect(
      getChallenge({ input: { timeZone: "UTC" }, planItemId: original.id }),
    ).resolves.toMatchObject({
      challenge: {
        date: ORIGINAL_MOCK,
        fullLength: false,
        minutes: 165,
        mock: true,
        questions: 30,
      },
      status: "ready",
    });

    const moved = await moveChallenge({ input: { timeZone: "UTC" }, planItemId: original.id });
    const after = await readSaved(plan.id);

    expect(moved).toStrictEqual({
      error: "unfundedMove",
      status: "invalid",
      unfundedMove: { date: FINAL_MOCK, minutes: 330 },
    });

    expect(after).toStrictEqual(before);
  });

  it("funds a fundable moved full mock at the same 330-minute clock as its challenge", async () => {
    const { goal, plan } = await setup({ dailyMinutes: 60, targetDate: new Date("2020-10-14") });
    const before = await readSaved(plan.id);

    const original = before.items.find(
      (item) => item.kind === "mock" && item.scheduledFor?.toISOString().startsWith(ORIGINAL_MOCK),
    );

    if (!original) {
      throw new Error("Expected the original weekly mock");
    }

    const moved = await moveChallenge({ input: { timeZone: "UTC" }, planItemId: original.id });

    expect(moved).toMatchObject({ move: { date: FINAL_MOCK }, status: "moved" });

    if (moved.status !== "moved" || !moved.move.planItemId) {
      throw new Error("Expected the funded moved mock's real item");
    }

    const after = await readSaved(plan.id);
    const funding = after.settings.mockFunding.find((entry) => entry.date === FINAL_MOCK);
    const item = after.items.find((entry) => entry.id === moved.move.planItemId);

    expect(item).toMatchObject({
      kind: "mock",
      scheduledFor: new Date(FINAL_MOCK),
      status: "todo",
    });

    await expect(
      getChallenge({ input: { timeZone: "UTC" }, planItemId: moved.move.planItemId }),
    ).resolves.toMatchObject({
      challenge: { date: FINAL_MOCK, fullLength: true, minutes: 330, mock: true, questions: 60 },
      status: "ready",
    });

    expect.soft(funding?.minutes).toBe(330);
    const view = await getGoalPlan(goal.id);

    if (view.status !== "ready") {
      throw new Error("Expected the moved mock's Plan view");
    }

    expect(view.plan.fundedMocks.find((entry) => entry.id === item?.id)).toMatchObject({
      minutes: 330,
      scheduledFor: FINAL_MOCK,
    });
  });

  it("keeps a thin-bank scheduled mock's announced clock on its actual day and when started", async () => {
    const { goal, library, plan } = await setup();

    await Promise.all(
      Array.from({ length: 6 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: library.skills[0]?.id ?? "" }),
      ),
    );

    const saved = await readSaved(plan.id);

    const item = saved.items.find(
      (entry) =>
        entry.kind === "mock" && entry.scheduledFor?.toISOString().startsWith(ORIGINAL_MOCK),
    );

    if (!item) {
      throw new Error("Expected the scheduled day-one mock");
    }

    expect(saved.settings.mockFunding.find((entry) => entry.date === ORIGINAL_MOCK)).toMatchObject({
      day: 1,
      fullLength: false,
      minutes: 165,
    });

    vi.setSystemTime(new Date("2020-10-08T12:00:00Z"));

    await expect(
      getChallenge({ input: { timeZone: "UTC" }, planItemId: item.id }),
    ).resolves.toMatchObject({
      challenge: { fullLength: false, minutes: 165, questions: 30 },
      status: "ready",
    });

    vi.setSystemTime(new Date(`${ORIGINAL_MOCK}T12:00:00Z`));
    const actual = await getChallenge({ input: { timeZone: "UTC" }, planItemId: item.id });

    expect
      .soft(actual)
      .toMatchObject({
        challenge: { fullLength: false, minutes: 165, questions: 6 },
        status: "ready",
      });

    const [view, today] = await Promise.all([
      getGoalPlan(goal.id),
      getTodayView({ goalId: goal.id, timeZone: "UTC" }),
    ]);

    if (view.status !== "ready" || today.status !== "ready") {
      throw new Error("Expected the scheduled mock's actual Plan and Today");
    }

    expect(
      view.plan.week.days
        .flatMap((day) => day.items)
        .find((entry) => entry.kind === "mock" && entry.scheduledFor === ORIGINAL_MOCK),
    ).toMatchObject({ minutes: 165 });

    const block = today.today.session.blocks.find((entry) => entry.checkpoint?.mock);

    if (!block) {
      throw new Error("Expected the scheduled mock in the real session");
    }

    await expect(getMock(block.id)).resolves.toMatchObject({
      mock: { fullLength: false, minutes: 165, questions: 6 },
      status: "ready",
    });

    await expect(
      startMock({ blockId: block.id, input: { timeZone: "UTC" } }),
    ).resolves.toMatchObject({ status: "ready" });

    const sitting = await prisma.mockExam.findUniqueOrThrow({ where: { blockId: block.id } });
    const conditions = mockConditionsSchema.parse(sitting.conditions);

    expect(conditions).toMatchObject({ day: 1, fullLength: false });
    expect(conditions.sections.reduce((sum, section) => sum + section.minutes, 0)).toBe(165);
    const after = await readSaved(plan.id);

    expect(after.settings.mockFunding.find((entry) => entry.date === ORIGINAL_MOCK)).toMatchObject({
      day: 1,
      fullLength: false,
      minutes: 165,
    });
  });

  it.each([
    { dailyMinutes: 30, fullMocks: 0, name: "regular", targetDate: null },
    {
      dailyMinutes: 180,
      fullMocks: 1,
      name: "regular and full day one",
      targetDate: new Date("2020-12-28"),
    },
    {
      dailyMinutes: 180,
      fullMocks: 1,
      name: "regular and full day two",
      targetDate: new Date("2021-01-04"),
    },
  ])(
    "alternates $name announced exam days independently of the bank and finished count",
    async ({ dailyMinutes, fullMocks, targetDate }) => {
      const { blueprint, goal, library, plan, user } = await setup({
        dailyMinutes,
        targetDate,
        twoDays: true,
      });

      const saved = await readSaved(plan.id);

      const mocks = saved.items
        .filter((item) => item.kind === "mock" && item.status === "todo" && item.scheduledFor)
        .toSorted((a, b) => (a.scheduledFor?.getTime() ?? 0) - (b.scheduledFor?.getTime() ?? 0));

      const finalStart = parsePlanPhases(saved.phases).find(
        (phase) => phase.kind === "finalStretch",
      )?.startDate;

      expect(mocks.length).toBeGreaterThanOrEqual(2);

      expect(
        mocks.filter(
          (item) =>
            finalStart && (item.scheduledFor?.toISOString().slice(0, 10) ?? "") >= finalStart,
        ).length,
      ).toBeGreaterThanOrEqual(fullMocks);

      // Only day two has questions: its bank must not change the first scheduled day into day two.
      const bank = await Promise.all(
        Array.from({ length: 18 }, () =>
          itemFixture({ content: choiceItemContent(), skillId: library.skills[1]?.id ?? "" }),
        ),
      );

      const selected = mocks.filter(
        (item, index) =>
          index < 2 ||
          (finalStart && (item.scheduledFor?.toISOString().slice(0, 10) ?? "") >= finalStart),
      );

      const expected = selected.map((item) => {
        const day = mocks.indexOf(item) % 2 === 0 ? 1 : 2;
        const date = item.scheduledFor?.toISOString().slice(0, 10) ?? "";
        const fullLength = Boolean(finalStart && date >= finalStart);
        const minutes = (day === 1 ? 330 : 300) * (fullLength ? 1 : 0.5);
        return { date, day, fullLength, item, minutes, name: day === 1 ? "Languages" : "Math" };
      });

      for (const entry of expected) {
        const funding = saved.settings.mockFunding.find(
          (candidate) => candidate.date === entry.date,
        );

        expect
          .soft(funding)
          .toMatchObject({ day: entry.day, fullLength: entry.fullLength, minutes: entry.minutes });
        // oxlint-disable-next-line eslint/no-await-in-loop -- Each read needs a different frozen request date; parallel reads would race the shared clock.
        const announced = await readAnnounced({
          date: entry.date,
          goalId: goal.id,
          planItemId: entry.item.id,
        });

        expect
          .soft(announced.item)
          .toMatchObject({ minutes: entry.minutes, scheduledFor: entry.date });

        expect
          .soft(announced.challenge)
          .toMatchObject({
            challenge: {
              fullLength: entry.fullLength,
              minutes: entry.minutes,
              sections: [expect.objectContaining({ name: entry.name })],
            },
            status: "ready",
          });
      }

      vi.setSystemTime(new Date(`${START}T15:00:00Z`));

      await prisma.mockExam.create({
        data: {
          conditions: mockConditionsSchema.parse({
            day: 2,
            fullLength: false,
            purpose: "practice",
            scoring: "raw",
            sections: [
              {
                itemIds: bank.map((item) => item.id),
                minutes: 150,
                name: "Math",
                questions: bank.length,
                routing: null,
              },
            ],
            startTime: null,
            timeZone: "UTC",
          }),
          examBlueprintId: blueprint.id,
          finishedAt: new Date(),
          goalId: goal.id,
          sectionStartedAt: new Date(),
          status: "finished",
          userId: user.id,
        },
      });

      await Promise.all(
        Array.from({ length: 18 }, () =>
          itemFixture({ content: choiceItemContent(), skillId: library.skills[0]?.id ?? "" }),
        ),
      );

      const afterHistory = await Promise.all(
        expected.map((entry) =>
          getChallenge({ input: { timeZone: "UTC" }, planItemId: entry.item.id }),
        ),
      );

      expected.forEach((entry, index) => {
        expect
          .soft(afterHistory[index])
          .toMatchObject({
            challenge: {
              fullLength: entry.fullLength,
              minutes: entry.minutes,
              sections: [expect.objectContaining({ name: entry.name })],
            },
            status: "ready",
          });
      });

      const afterReads = await readSaved(plan.id);
      expect(afterReads.settings.mockFunding).toStrictEqual(saved.settings.mockFunding);
      expect(afterReads.items).toStrictEqual(saved.items);
    },
  );
});
