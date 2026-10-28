import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planResponseSchema } from "../../../../apps/api/src/lib/openapi/schemas/plans";
import { todayResponseSchema } from "../../../../apps/api/src/lib/openapi/schemas/today";
import { serializeToday } from "../../../../apps/api/src/lib/study-session-serializers";
import { mockSession } from "../_test-utils/mock-session";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { openTodayView } from "../sessions/_test-utils/open-today-view";
import {
  NET_SCORED_EXAM_STRUCTURE,
  SESSION_TODAY,
  sessionGoalFixture,
} from "../sessions/_test-utils/session-goal";
import { getTodayView } from "../view-models/today/get-today-view";
import { getGoalPlan } from "./get-goal-plan";
import { findMockFundingOn } from "./planner/mock-funding";
import { parsePlanSettings } from "./planner/plan-state";

const MOCK_DATE = "2026-10-11";

const FUNDING = [
  {
    contributions: [
      { date: "2026-09-30", minutes: 30 },
      { date: "2026-10-01", minutes: 30 },
      { date: "2026-10-08", minutes: 30 },
      { date: "2026-10-09", minutes: 30 },
    ],
    date: MOCK_DATE,
    minutes: 165,
  },
];

function setDay(date: string) {
  const instant = new Date(`${date}T12:00:00Z`);
  vi.setSystemTime(instant);

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: new Date(date),
    currentInstant: instant,
    timeZone: "UTC",
  });
}

/** Saved, balanced mock funding: 120 banked minutes and its own 45-minute study day. */
async function setup() {
  const user = await userFixture();

  const fixture = await sessionGoalFixture({
    goal: { createdAt: new Date("2026-09-28"), kind: "exam", targetDate: new Date("2026-11-01") },
    userId: user.id,
  });

  const mock = await planItemFixture({
    kind: "mock",
    planId: fixture.plan.id,
    position: fixture.planItems.length,
    scheduledFor: new Date(MOCK_DATE),
    titleSnapshot: "Full mock",
  });

  await prisma.plan.update({
    data: { settings: { mockFunding: FUNDING, startDate: "2026-09-28" } },
    where: { id: fixture.plan.id },
  });

  mockSession(user.id);
  return { ...fixture, mock, user };
}

describe("public mock funding views", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setDay("2026-09-30");
  });

  afterEach(() => vi.useRealTimers());

  it("shows exact saved funding in Plan and Today and the real upcoming mock item before its week", async () => {
    const { goal, mock, plan } = await setup();
    const planned = await getGoalPlan(goal.id);
    expect(planned.status).toBe("ready");

    if (planned.status !== "ready") {
      throw new Error("Expected Plan");
    }

    expect(planned.plan).toMatchObject({
      fundedMocks: [
        {
          id: mock.id,
          kind: "mock",
          minutes: 165,
          requiresPlus: true,
          scheduledFor: MOCK_DATE,
          status: "todo",
        },
      ],
    });

    expect(planned.plan.week.days.find((day) => day.date === "2026-09-30")).toMatchObject({
      minutes: 15,
      mockFunding: { mockDate: MOCK_DATE, mockMinutes: 165, setAsideMinutes: 30 },
    });

    const today = await getTodayView({ goalId: goal.id });

    if (today.status !== "ready") {
      throw new Error("Expected Today");
    }

    expect(today.today).toMatchObject({
      mockFunding: { mockDate: MOCK_DATE, mockMinutes: 165, setAsideMinutes: 30 },
      session: { minutes: { dailyGoal: 15, planned: 12 } },
    });

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(parsePlanSettings(saved.settings).mockFunding).toStrictEqual(FUNDING);
    expect(planResponseSchema.parse(planned.plan)).toStrictEqual(planned.plan);

    expect(todayResponseSchema.parse(serializeToday(today.today))).toMatchObject({
      mockFunding: today.today.mockFunding,
    });
  });

  it("keeps a persisted welcome-back session's funding, so Today can say what else its lighter day saves time for", async () => {
    const { goal, mock, plan } = await setup();

    await Promise.all([
      prisma.goal.update({ data: { createdAt: new Date("2026-09-25") }, where: { id: goal.id } }),
      prisma.plan.update({
        data: { settings: { mockFunding: FUNDING, startDate: "2026-09-25" } },
        where: { id: plan.id },
      }),
    ]);

    const today = await openTodayView({ goalId: goal.id });

    if (today.status !== "ready") {
      throw new Error("Expected welcome-back Today");
    }

    const session = await prisma.studySession.findUniqueOrThrow({
      where: { id: today.today.session.id },
    });

    expect(session.freshStart).toBe("welcomeBack");

    expect(today.today.session).toMatchObject({
      freshStart: "welcomeBack",
      minutes: { dailyGoal: 15 },
    });

    expect(today.today.mockFunding).toStrictEqual({
      mockDate: MOCK_DATE,
      mockMinutes: 165,
      setAsideMinutes: 30,
    });

    expect(todayResponseSchema.parse(serializeToday(today.today))).toMatchObject({
      mockFunding: today.today.mockFunding,
      session: { freshStart: "welcomeBack", minutes: { dailyGoal: 15 } },
    });

    const planned = await getGoalPlan(goal.id);

    if (planned.status !== "ready") {
      throw new Error("Expected welcome-back Plan");
    }

    expect(planned.plan.week.days.find((day) => day.date === "2026-09-30")).toMatchObject({
      minutes: 15,
      mockFunding: { mockDate: MOCK_DATE, mockMinutes: 165, setAsideMinutes: 30 },
    });

    expect(planned.plan.fundedMocks).toMatchObject([{ id: mock.id, minutes: 165 }]);
    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(parsePlanSettings(saved.settings).mockFunding).toStrictEqual(FUNDING);
  });

  it("has no funding metadata on an unrelated study day or the mock's own day", async () => {
    const { goal } = await setup();
    setDay("2026-10-02");
    const today = await getTodayView({ goalId: goal.id });

    if (today.status !== "ready") {
      throw new Error("Expected Today");
    }

    expect(today.today).toMatchObject({ mockFunding: null });
    const plan = await getGoalPlan(goal.id);

    if (plan.status !== "ready") {
      throw new Error("Expected Plan");
    }

    expect(plan.plan.week.days.find((day) => day.date === "2026-10-02")).toMatchObject({
      mockFunding: null,
    });

    setDay(MOCK_DATE);
    const onMockDay = await getGoalPlan(goal.id);

    if (onMockDay.status !== "ready") {
      throw new Error("Expected mock-day Plan");
    }

    expect(onMockDay.plan).toMatchObject({ fundedMocks: [] });

    expect(onMockDay.plan.week.days.find((day) => day.date === MOCK_DATE)).toMatchObject({
      minutes: 165,
      mockFunding: null,
    });
  });

  it("reveals only real future todo mocks once their funding starts", async () => {
    const { goal, mock, plan } = await setup();

    const later = {
      contributions: [{ date: "2026-10-15", minutes: 30 }],
      date: "2026-10-16",
      minutes: 75,
    };

    await Promise.all([
      prisma.plan.update({
        data: {
          settings: {
            mockFunding: [
              ...FUNDING,
              later,
              {
                contributions: [{ date: "2026-09-29", minutes: 30 }],
                date: "2026-10-18",
                minutes: 75,
              },
            ],
          },
        },
        where: { id: plan.id },
      }),
      planItemFixture({
        kind: "mock",
        planId: plan.id,
        position: 4,
        scheduledFor: new Date(later.date),
      }),
      planItemFixture({
        kind: "mock",
        planId: plan.id,
        position: 5,
        scheduledFor: new Date("2026-10-18"),
        status: "done",
      }),
      planItemFixture({
        kind: "boss",
        planId: plan.id,
        position: 6,
        scheduledFor: new Date(MOCK_DATE),
      }),
    ]);

    setDay("2026-09-29");
    const before = await getGoalPlan(goal.id);

    if (before.status !== "ready") {
      throw new Error("Expected Plan before funding");
    }

    expect(before.plan).toMatchObject({ fundedMocks: [] });
    setDay("2026-09-30");
    const after = await getGoalPlan(goal.id);

    if (after.status !== "ready") {
      throw new Error("Expected funded Plan");
    }

    expect(after.plan).toMatchObject({ fundedMocks: [{ id: mock.id, minutes: 165 }] });
  });

  it("previews the selected funding without saving, then opens that same funded day", async () => {
    const { goal, plan, skills } = await setup();

    const blueprint = await examBlueprintFixture({
      structure: {
        ...NET_SCORED_EXAM_STRUCTURE,
        mock: { ...NET_SCORED_EXAM_STRUCTURE.mock, timeLimitMinutes: 330 },
      },
    });

    await Promise.all([
      prisma.goal.update({ data: { examBlueprintId: blueprint.id }, where: { id: goal.id } }),
      prisma.plan.update({
        data: {
          graph: {
            phases: [{ milestone: null, name: "Basics" }],
            skills: skills.map((skill) => ({
              area: "Math",
              lessons: 1,
              name: skill.name,
              outlined: true,
              phase: 0,
              skillId: skill.id,
              weight: 1,
            })),
          },
        },
        where: { id: plan.id },
      }),
    ]);

    // GET is read-only; the learner's POST persists the same selected allocation.
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const result = await getTodayView({ goalId: goal.id });

    if (result.status !== "ready") {
      throw new Error("Expected refreshed Today");
    }

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toStrictEqual(
      before,
    );

    const opened = await openTodayView({ goalId: goal.id });
    const refreshed = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(refreshed.version).toBeGreaterThan(plan.version);

    const expected = findMockFundingOn({
      date: SESSION_TODAY,
      funding: parsePlanSettings(refreshed.settings).mockFunding,
    });

    expect(expected).not.toBeNull();

    expect(expected).not.toStrictEqual({
      mockDate: MOCK_DATE,
      mockMinutes: 165,
      setAsideMinutes: 30,
    });

    expect(opened.today.mockFunding).toMatchObject({
      mockDate: result.today.mockFunding?.mockDate,
      mockMinutes: result.today.mockFunding?.mockMinutes,
    });

    expect(opened.today.session.minutes.planned).toBe(result.today.session.minutes.planned);
    expect(opened.today.session.week.time).toBeDefined();
    expect(opened.today).toMatchObject({ mockFunding: expected });
    expect(opened.today.session.minutes.dailyGoal % 1).not.toBe(0);
    expect(opened.today.session.week.time.targetMinutes % 1).not.toBe(0);

    expect(todayResponseSchema.parse(serializeToday(opened.today))).toMatchObject({
      mockFunding: expected,
      session: {
        minutes: opened.today.session.minutes,
        week: { time: opened.today.session.week.time },
      },
    });

    const updated = await getGoalPlan(goal.id);

    if (updated.status !== "ready") {
      throw new Error("Expected updated Plan");
    }

    expect(planResponseSchema.parse(updated.plan)).toStrictEqual(updated.plan);
  });

  it("keeps funding behind the existing Plan and Today ownership boundaries", async () => {
    const { goal } = await setup();
    const other = await userFixture();
    mockSession(other.id);
    await expect(getGoalPlan(goal.id)).resolves.toStrictEqual({ status: "notFound" });
    await expect(getTodayView({ goalId: goal.id })).resolves.toStrictEqual({ status: "notFound" });
    mockSession(null);
    await expect(getGoalPlan(goal.id)).resolves.toStrictEqual({ status: "unauthorized" });

    await expect(getTodayView({ goalId: goal.id })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });
});
