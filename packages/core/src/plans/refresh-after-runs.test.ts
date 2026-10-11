import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { refreshGoalPlan } from "./refresh-goal-plan";

/** A Monday in 2020, before the learning events other tests write, which estimates read. */
const START = "2020-09-28";

function setToday(isoDate: string) {
  const instant = new Date(`${isoDate}T12:00:00Z`);
  vi.setSystemTime(instant);

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: new Date(`${isoDate}T00:00:00Z`),
    currentInstant: instant,
    timeZone: "UTC",
  });
}

/** A learn plan of two areas at 12 minutes a day, made today, with today's session opened. */
async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Basics", "Next steps"],
    skills: [
      { area: "Math", lessons: 6 },
      { area: "Writing", lessons: 6 },
      { area: "Math", lessons: 6, phase: 1 },
      { area: "Writing", lessons: 6, phase: 1 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: START },
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);
  await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });

  return { goal, library, plan, user };
}

/** Opens Today three days later: the day's first run settles what the missed days left. */
async function settleMissedDays({ goalId, planId }: { goalId: string; planId: string }) {
  setToday("2020-10-01");
  await getTodayStudySession({ goalId, timeZone: "UTC" });

  await expect(prisma.planChange.count({ where: { kind: "missedDays", planId } })).resolves.toBe(1);
}

/** The plan as saved, with its items. */
function readSaved(planId: string) {
  return prisma.plan.findUniqueOrThrow({
    include: { items: { orderBy: { position: "asc" } } },
    where: { id: planId },
  });
}

/**
 * A system refresh with nothing new (a landing for another goal, the lookahead): what it says, and
 * the plan as saved after it.
 */
async function refreshWithNothingNew({ goalId, planId }: { goalId: string; planId: string }) {
  const result = await refreshGoalPlan({ goalId });
  return { plan: await readSaved(planId), result };
}

/*
 * R32: a system refresh with nothing new right after a run that planned the day keeps the plan that
 * run saved: it plans from what that run planned from (see `getPlanInputsKey`), whatever mode it
 * lays the plan out in. Planned again in another mode, an OAB plan a focus re-planned on day one
 * moved 600 items, an ENEM focus lost 21 lessons, an ENEM plan an undo gave back moved 70 and an
 * ENEM plan the learner changed after the day's settle moved 227.
 */
describe("a refresh right after a run that planned the day", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setToday(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the plan a change of focus saved", async () => {
    const { goal, plan } = await setup();

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: {
          operations: [
            { areas: ["Writing"], kind: "focusAreas" },
            { areas: ["Math"], kind: "reduceAreas" },
          ],
        },
      }),
    ).resolves.toMatchObject({ status: "applied" });

    const saved = await readSaved(plan.id);

    await expect(
      refreshWithNothingNew({ goalId: goal.id, planId: plan.id }),
    ).resolves.toStrictEqual({ plan: saved, result: { status: "unchanged" } });
  });

  it("keeps the plan the day's settle saved", async () => {
    const { goal, plan } = await setup();

    await settleMissedDays({ goalId: goal.id, planId: plan.id });

    const saved = await readSaved(plan.id);

    await expect(
      refreshWithNothingNew({ goalId: goal.id, planId: plan.id }),
    ).resolves.toStrictEqual({ plan: saved, result: { status: "unchanged" } });
  });

  it("keeps the plan a change made after the day's settle saved", async () => {
    const { goal, plan } = await setup();

    await settleMissedDays({ goalId: goal.id, planId: plan.id });

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ bias: "moreExplanation", kind: "setPracticeBias" }] },
      }),
    ).resolves.toMatchObject({ status: "applied" });

    const saved = await readSaved(plan.id);

    await expect(
      refreshWithNothingNew({ goalId: goal.id, planId: plan.id }),
    ).resolves.toStrictEqual({ plan: saved, result: { status: "unchanged" } });
  });

  it("keeps the plan an undo gave back", async () => {
    const { goal, plan } = await setup();

    const changed = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 20 }] },
    });

    await expect(
      decidePlanChange({
        changeId: changed.status === "applied" ? (changed.change?.id ?? "") : "",
        goalId: goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toMatchObject({ change: { status: "undone" }, status: "updated" });

    const saved = await readSaved(plan.id);

    await expect(
      refreshWithNothingNew({ goalId: goal.id, planId: plan.id }),
    ).resolves.toStrictEqual({ plan: saved, result: { status: "unchanged" } });
  });
});

/** How many lessons each day from tomorrow to Sunday holds. */
async function countWeekLessons(planId: string) {
  const items = await prisma.planItem.findMany({
    where: {
      kind: "lesson",
      planId,
      scheduledFor: {
        gte: new Date("2020-09-29T00:00:00Z"),
        lte: new Date("2020-10-04T00:00:00Z"),
      },
    },
  });

  const days = Map.groupBy(items, (item) => item.scheduledFor?.toISOString().slice(0, 10) ?? "");
  return Object.fromEntries([...days].map(([day, lessons]) => [day, lessons.length]));
}

// A session whose new pace no longer fits this week's work in it lays the rest out from the next
// day at that pace, as that day's first run would, so the next morning finds the plan it saved.
// Kept as it was, a Câmara plan whose pace slowed spilled three days into the next week, and the
// next morning's settling planned the week again: 29 lessons of 10 skills left the plan and 5 came
// in.
describe("a session whose slower pace no longer fits this week", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setToday(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lays this week out again from tomorrow at the new pace", async () => {
    const { goal, library, plan, user } = await setup();

    // Two 3-minute lessons a day fit the learner's lesson time; they finished today's.
    await expect(countWeekLessons(plan.id)).resolves.toStrictEqual({
      "2020-09-29": 2,
      "2020-09-30": 2,
      "2020-10-01": 2,
      "2020-10-02": 2,
      "2020-10-03": 2,
    });

    await prisma.planItem.updateMany({
      data: { completedAt: new Date(`${START}T12:00:00Z`), status: "done" },
      where: { kind: "lesson", planId: plan.id, scheduledFor: new Date(`${START}T00:00:00Z`) },
    });

    // They took four times each lesson's estimate, long ago enough that no one else's pace reads it.
    await Promise.all(
      library.lessons
        .slice(0, 8)
        .map((lesson) =>
          learningEventFixture({
            contentIds: { lessonId: lesson.id },
            endedAt: new Date("2001-01-01T12:00:00Z"),
            seconds: 720,
            userId: user.id,
          }),
        ),
    );

    await refreshGoalPlan({ goalId: goal.id, pace: "sampled" });

    // At almost twice the estimate, one lesson a day fits: the week is laid out again from
    // tomorrow, as tomorrow's first run would lay it, not kept past the learner's time.
    await expect(countWeekLessons(plan.id)).resolves.toStrictEqual({
      "2020-09-29": 1,
      "2020-09-30": 1,
      "2020-10-01": 1,
      "2020-10-02": 1,
      "2020-10-03": 1,
    });
  });
});
