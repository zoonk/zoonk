import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { parsePlanChangePayload } from "../plans/_utils/plan-change-payload";
import { changeGoalPlan } from "../plans/change-goal-plan";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getGoalPlan } from "../plans/get-goal-plan";
import { refreshGoalPlan } from "../plans/refresh-goal-plan";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { catchUpToday } from "./catch-up-today";
import { getTodayStudySession } from "./get-today-study-session";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

function setToday(isoDate: string) {
  const instant = new Date(`${isoDate}T12:00:00Z`);
  vi.setSystemTime(instant);

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: new Date(`${isoDate}T00:00:00Z`),
    currentInstant: instant,
    timeZone: "UTC",
  });
}

/** An exam of three subjects in a study cycle, two months away (2020, so others' pace stays out). */
async function examGoal(userId: string, dailyMinutes = 30) {
  const library = await planLibraryFixture({
    skills: [
      { area: "Math", lessons: 20, weight: 5 },
      { area: "Law", lessons: 20, weight: 3 },
      { area: "Portuguese", lessons: 20, weight: 1 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes,
    kind: "exam",
    settings: { startDate: "2020-09-28" },
    targetDate: new Date("2020-11-29T00:00:00Z"),
    timezone: "UTC",
    userId,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  return { goal, plan };
}

/** A learn goal without a date, at 15 minutes a day. */
async function learnGoal(userId: string) {
  const library = await planLibraryFixture({ skills: [{ lessons: 12 }, { lessons: 12 }] });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 15,
    settings: { startDate: "2020-09-28" },
    timezone: "UTC",
    userId,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  return { goal, plan };
}

async function learner() {
  const user = await userFixture();
  mockSession(user.id);
  return user;
}

async function openToday(goalId: string) {
  const finishDeferredWork = runDeferredWork();
  const result = await getTodayStudySession({ goalId, timeZone: "UTC" });
  await finishDeferredWork();

  if (result.status !== "ready") {
    throw new Error(`Expected today's session, got ${result.status}`);
  }

  return prisma.studySession.findUniqueOrThrow({
    include: { blocks: { orderBy: { position: "asc" } } },
    where: { id: result.session.id },
  });
}

type Day = Awaited<ReturnType<typeof openToday>>;

function lessonIds(day: Day): string[] {
  return day.blocks.flatMap((block) =>
    block.kind === "learn" && block.lessonId ? [block.lessonId] : [],
  );
}

/** The learner finishes the day's first lessons, as finishing them in the player does. */
async function finishLessons({ count, day, planId }: { count: number; day: Day; planId: string }) {
  const finished = day.blocks.filter((block) => block.kind === "learn").slice(0, count);

  await prisma.studySessionBlock.updateMany({
    data: { completedAt: new Date(), startedAt: new Date(), status: "completed" },
    where: { id: { in: finished.map((block) => block.id) } },
  });

  await prisma.studySession.update({ data: { startedAt: new Date() }, where: { id: day.id } });

  await prisma.planItem.updateMany({
    data: { completedAt: new Date(), status: "done" },
    where: { lessonId: { in: finished.flatMap((block) => block.lessonId ?? []) }, planId },
  });

  return day.blocks
    .filter((block) => block.kind === "learn" && !finished.includes(block))
    .flatMap((block) => block.lessonId ?? []);
}

/** The plan's lessons still to do, in any order: nothing an earlier day left is dropped. */
async function todoLessons(planId: string) {
  const items = await prisma.planItem.findMany({
    where: { kind: "lesson", lessonId: { not: null }, planId, status: "todo" },
  });

  return items.flatMap((item) => item.lessonId ?? []).toSorted((a, b) => a.localeCompare(b));
}

/** A goal due on Friday the next week, whose 12 minutes a day cover it with room to spare. */
async function datedGoal(userId: string) {
  const library = await planLibraryFixture({ skills: [{ lessons: 4 }, { lessons: 4 }] });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    targetDate: new Date("2020-10-09T00:00:00Z"),
    timezone: "UTC",
    userId,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  return { goal, plan };
}

async function readStatus(goalId: string) {
  const result = await getGoalPlan(goalId);
  return result.status === "ready" ? result.plan.status : null;
}

describe("work an earlier day left", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setToday("2020-09-28");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the next day with a partly missed day's lessons, in order, at the day's size", async () => {
    const user = await learner();
    const { goal, plan } = await examGoal(user.id);
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

    const monday = await openToday(goal.id);
    const left = await finishLessons({ count: 2, day: monday, planId: plan.id });
    const todo = await todoLessons(plan.id);

    setToday("2020-09-29");
    const tuesday = await openToday(goal.id);

    expect(left.length).toBeGreaterThan(0);
    expect(lessonIds(tuesday).slice(0, left.length)).toStrictEqual(left);
    expect(tuesday.plannedMinutes).toBeLessThanOrEqual(goal.dailyMinutes + 5);
    await expect(todoLessons(plan.id)).resolves.toStrictEqual(todo);

    const changes = await prisma.planChange.findMany({ where: { planId: plan.id } });
    expect(changes).toMatchObject([{ kind: "missedDays", payload: { days: 1 } }]);
  });

  it("opens the next day with every lesson of a day the learner opened and didn't study", async () => {
    const user = await learner();
    const { goal, plan } = await examGoal(user.id);

    const monday = await openToday(goal.id);
    const left = lessonIds(monday);

    setToday("2020-09-29");
    const tuesday = await openToday(goal.id);

    expect(lessonIds(tuesday).slice(0, left.length)).toStrictEqual(left);
    expect(tuesday.plannedMinutes).toBeLessThanOrEqual(goal.dailyMinutes + 5);
    const todo = await todoLessons(plan.id);
    expect(todo.length).toBeGreaterThan(0);
  });

  it("carries two missed days, the first day's lessons first", async () => {
    const user = await learner();
    const { goal, plan } = await examGoal(user.id);
    const todo = await todoLessons(plan.id);

    const dueOn = async (isoDate: string) =>
      prisma.planItem
        .findMany({
          orderBy: { position: "asc" },
          where: {
            kind: "lesson",
            planId: plan.id,
            scheduledFor: new Date(`${isoDate}T00:00:00Z`),
          },
        })
        .then((items) => items.flatMap((item) => item.lessonId ?? []));

    const missed = [...(await dueOn("2020-09-28")), ...(await dueOn("2020-09-29"))];

    setToday("2020-09-30");
    const wednesday = await openToday(goal.id);

    // Two days of lessons don't fit in one: the day takes what fits, oldest first, and the day
    // keeps its size.
    const due = await dueOn("2020-09-30");

    expect(due).toStrictEqual(missed.slice(0, due.length));
    expect(lessonIds(wednesday).slice(0, due.length)).toStrictEqual(due);
    expect(wednesday.plannedMinutes).toBeLessThanOrEqual(goal.dailyMinutes + 5);
    await expect(todoLessons(plan.id)).resolves.toStrictEqual(todo);

    // What Wednesday didn't fit is Thursday's start.
    const rest = missed.slice(due.length);
    const thursday = await dueOn("2020-10-01");
    expect(thursday.slice(0, rest.length)).toStrictEqual(rest);
  });

  it("keeps a missed day's lessons when the learner changes their time the next day", async () => {
    const user = await learner();
    const { goal, plan } = await examGoal(user.id);

    const monday = await openToday(goal.id);
    const left = await finishLessons({ count: 1, day: monday, planId: plan.id });
    const todo = await todoLessons(plan.id);

    setToday("2020-09-29");
    await openToday(goal.id);

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 45 }], timeZone: "UTC" },
    });

    const tuesday = await openToday(goal.id);

    expect(lessonIds(tuesday).slice(0, left.length)).toStrictEqual(left);
    await expect(todoLessons(plan.id)).resolves.toStrictEqual(todo);
  });

  it("settles each of a learner's goals on its own", async () => {
    const user = await learner();
    const [exam, learn] = [await examGoal(user.id), await learnGoal(user.id)];

    const examMonday = await openToday(exam.goal.id);
    const learnMonday = await openToday(learn.goal.id);
    const examLeft = await finishLessons({ count: 1, day: examMonday, planId: exam.plan.id });
    const learnTodo = await todoLessons(learn.plan.id);

    // The learn goal's day was studied in full.
    await finishLessons({
      count: lessonIds(learnMonday).length,
      day: learnMonday,
      planId: learn.plan.id,
    });

    const learnPlan = await prisma.plan.findUniqueOrThrow({ where: { id: learn.plan.id } });

    setToday("2020-09-29");
    const [examTuesday] = [await openToday(exam.goal.id), await openToday(learn.goal.id)];

    expect(lessonIds(examTuesday).slice(0, examLeft.length)).toStrictEqual(examLeft);

    // Nothing was left on the learn goal, so its plan didn't move.
    const learnAfter = await prisma.plan.findUniqueOrThrow({ where: { id: learn.plan.id } });
    expect(learnAfter.version).toBe(learnPlan.version);
    const learnLeft = await todoLessons(learn.plan.id);
    expect(learnLeft.length).toBeLessThan(learnTodo.length);
  });
});

describe("falling behind", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setToday("2020-09-28");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks what to do when days away put the date at risk", async () => {
    const user = await learner();
    const { goal, plan } = await datedGoal(user.id);
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      coveredShare: 1,
    });

    // Away until the Thursday before the date: two days left for all of it.
    setToday("2020-10-07");
    const result = await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });
    expect(result.status).toBe("ready");

    const [change] = await prisma.planChange.findMany({ where: { planId: plan.id } });
    const { behind } = parsePlanChangePayload(change?.payload);

    expect(change?.kind).toBe("missedDays");
    expect(behind).toMatchObject({ coveredBefore: 1, fullDepth: true, measure: "goal" });
    expect(behind?.coveredAfter ?? 1).toBeLessThan(1);
    expect(behind?.dailyMinutes ?? 0).toBeGreaterThan(goal.dailyMinutes);
  });

  it("only moves the plan on when the time left still covers the goal", async () => {
    const user = await learner();
    const { goal, plan } = await datedGoal(user.id);

    setToday("2020-09-29");
    await openToday(goal.id);

    const [change] = await prisma.planChange.findMany({ where: { planId: plan.id } });

    expect(change).toMatchObject({ kind: "missedDays", payload: { behind: null } });
  });
});

describe("catching up", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setToday("2020-09-28");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says how far behind, catches up today on a tap, and is on pace once it's done", async () => {
    const user = await learner();
    const { goal, plan } = await examGoal(user.id);

    // Monday opened and not studied, Tuesday missed: Wednesday can't fit both days.
    await openToday(goal.id);
    setToday("2020-09-30");

    const wednesday = await openToday(goal.id);
    const view = await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });
    const catchUp = view.status === "ready" ? view.session.catchUp : null;

    const settled = await prisma.planChange.findFirstOrThrow({
      where: { kind: "missedDays", planId: plan.id },
    });

    const left = parsePlanChangePayload(settled.payload);

    await expect(readStatus(goal.id)).resolves.toMatchObject({
      kind: "behind",
      lessons: left.carriedItemIds.length,
    });

    // Reading the day again settles nothing new: what didn't fit comes first tomorrow.
    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({
      status: "unchanged",
    });

    await expect(
      prisma.planChange.count({ where: { kind: "missedDays", planId: plan.id } }),
    ).resolves.toBe(1);

    // The day opens with them, and the rest don't fit in its normal time.
    expect(catchUp?.blockIds).toStrictEqual(
      wednesday.blocks.filter((block) => block.kind === "learn").map((block) => block.id),
    );

    expect(catchUp?.later.lessons).toBeGreaterThan(0);

    const caughtUp = await catchUpToday({ input: { timeZone: "UTC" }, sessionId: wednesday.id });

    expect(caughtUp.status).toBe("ready");
    expect(caughtUp.status === "ready" && caughtUp.session.catchUp?.later.lessons).toBe(0);

    await expect(
      catchUpToday({ input: { timeZone: "UTC" }, sessionId: wednesday.id }),
    ).resolves.toStrictEqual({ status: "nothingToCatchUp" });

    // Done with everything earlier days left: back on pace.
    await prisma.planItem.updateMany({
      data: { status: "done" },
      where: { id: { in: left.carriedItemIds } },
    });

    await expect(readStatus(goal.id)).resolves.not.toMatchObject({ kind: "behind" });
  });
});
