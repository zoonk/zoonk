import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { replanGoalsWaitingOnSkills } from "../library/curriculum/replan-waiting-goals";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { getTodayStudySession } from "../sessions/get-today-study-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { refreshGoalPlan } from "./refresh-goal-plan";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

function at(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`);
}

function setToday(isoDate: string) {
  vi.setSystemTime(at(isoDate));

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: new Date(`${isoDate}T00:00:00Z`),
    currentInstant: at(isoDate),
    timeZone: "UTC",
  });
}

/** An exam of three subjects in a study cycle, two months away, at 30 minutes a day. */
async function examSetup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [
      { area: "Math", lessons: 20, weight: 5 },
      { area: "Law", lessons: 20, weight: 3 },
      { area: "Portuguese", lessons: 20, weight: 1 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 30,
    kind: "exam",
    settings: { startDate: "2020-09-28" },
    targetDate: new Date("2020-11-29T00:00:00Z"),
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);

  return { goal, library, plan, user };
}

/** What a learner sees of the plan's time: each item's day, and the plan's version. */
async function readPlanDates(planId: string) {
  const [plan, items] = await Promise.all([
    prisma.plan.findUniqueOrThrow({ where: { id: planId } }),
    prisma.planItem.findMany({ orderBy: { position: "asc" }, where: { planId } }),
  ]);

  return {
    dates: items.map((item) => [item.id, item.scheduledFor?.toISOString().slice(0, 10)]),
    phases: plan.phases,
    version: plan.version,
  };
}

/** The learner studies every lesson due by `isoDate`, as finishing them in sessions does. */
async function studyThrough({ isoDate, planId }: { isoDate: string; planId: string }) {
  await prisma.planItem.updateMany({
    data: { completedAt: at(isoDate), status: "done" },
    where: {
      kind: { in: ["lesson", "chapter"] },
      planId,
      scheduledFor: { lte: new Date(`${isoDate}T00:00:00Z`) },
      status: "todo",
    },
  });
}

async function openToday(goalId: string) {
  const finishDeferredWork = runDeferredWork();
  const result = await getTodayStudySession({ goalId, timeZone: "UTC" });
  await finishDeferredWork();
  return result;
}

describe("a plan nobody changed", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setToday("2020-09-28");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps its version and dates through repeated reads of Today and the plan", async () => {
    const { goal, plan } = await examSetup();
    const built = await readPlanDates(plan.id);

    await openToday(goal.id);
    await getGoalPlan(goal.id);
    await openToday(goal.id);
    await getGoalPlan(goal.id);

    await expect(readPlanDates(plan.id)).resolves.toStrictEqual(built);
  });

  it("keeps its dates on the next days when the learner studied what each day asked", async () => {
    const { goal, plan } = await examSetup();

    await openToday(goal.id);
    await studyThrough({ isoDate: "2020-09-28", planId: plan.id });
    const studied = await readPlanDates(plan.id);

    // Tuesday, and the next Monday: a new day, then a new week.
    setToday("2020-09-29");
    await openToday(goal.id);
    await getGoalPlan(goal.id);
    await openToday(goal.id);

    await expect(readPlanDates(plan.id)).resolves.toStrictEqual(studied);

    await studyThrough({ isoDate: "2020-10-04", planId: plan.id });
    const week = await readPlanDates(plan.id);

    setToday("2020-10-05");
    await openToday(goal.id);
    await openToday(goal.id);

    await expect(readPlanDates(plan.id)).resolves.toStrictEqual(week);
  });

  it("writes nothing when a refresh finds nothing to settle", async () => {
    const { goal, plan } = await examSetup();
    await studyThrough({ isoDate: "2020-09-28", planId: plan.id });
    const studied = await readPlanDates(plan.id);

    setToday("2020-09-29");

    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({
      status: "unchanged",
    });

    await expect(readPlanDates(plan.id)).resolves.toStrictEqual(studied);
  });
});

/** Outlines `count` lessons for a skill, as the Library's outline does. */
async function outline({
  chapterId,
  count,
  from = 0,
  skillId,
}: {
  chapterId: string;
  count: number;
  /** The chapter position the first outlined lesson takes. */
  from?: number;
  skillId: string;
}) {
  await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const lesson = await libraryLessonFixture({
        estimatedMinutes: 3,
        homeChapterId: chapterId,
        title: `Outlined ${index} ${crypto.randomUUID()}`,
      });

      await Promise.all([
        chapterLessonFixture({ chapterId, lessonId: lesson.id, position: 900 + from + index }),
        lessonSkillFixture({ lessonId: lesson.id, skillId }),
      ]);
    }),
  );
}

/** An exam whose Law subject the Library hasn't outlined yet: its skill is a stand-in. */
async function standInSetup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [
      { area: "Math", lessons: 20, weight: 5 },
      { area: "Law", lessons: 0, size: 20, weight: 3 },
      { area: "Portuguese", lessons: 20, weight: 1 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 30,
    kind: "exam",
    settings: { startDate: "2020-09-28" },
    targetDate: new Date("2020-11-29T00:00:00Z"),
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, library, plan };
}

describe("the Library outlining a plan's lessons", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setToday("2020-09-28");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("puts a stand-in's lessons in its place this week and keeps every other day the learner saw", async () => {
    const { library, plan } = await standInSetup();
    const law = library.skills[1]?.id ?? "";
    const before = await prisma.planItem.findMany({ where: { planId: plan.id } });
    const lawFirst = before.find((item) => item.skillId === law && item.lessonId === null);

    expect(lawFirst?.scheduledFor?.toISOString().slice(0, 10)).toBe("2020-09-28");

    await outline({ chapterId: library.chapters[0]?.id ?? "", count: 20, skillId: law });
    await replanGoalsWaitingOnSkills({ skillIds: [law] });

    const after = await prisma.planItem.findMany({ where: { planId: plan.id } });

    // The outlined lessons start this week, where the stand-in was.
    const lawLessons = after.filter((item) => item.skillId === law && item.lessonId !== null);
    expect(lawLessons.length).toBeGreaterThan(0);

    expect(
      lawLessons.some((item) => item.scheduledFor?.toISOString().slice(0, 10) === "2020-09-28"),
    ).toBe(true);

    expect(after.some((item) => item.skillId === law && item.lessonId === null)).toBe(false);
  });

  it("keeps this week's days when a later stand-in's lessons are outlined", async () => {
    const { goal, library, plan } = await standInSetup();
    const law = library.skills[1]?.id ?? "";
    const chapterId = library.chapters[0]?.id ?? "";

    // Law's first lessons are outlined; the rest of Law waits as a stand-in.
    await outline({ chapterId, count: 5, skillId: law });
    await replanGoalsWaitingOnSkills({ skillIds: [law] });

    const thisWeek = async () =>
      prisma.planItem
        .findMany({
          orderBy: { position: "asc" },
          where: { planId: plan.id, scheduledFor: { lte: new Date("2020-10-04T00:00:00Z") } },
        })
        .then((items) => items.map((item) => [item.id, item.scheduledFor?.toISOString()]));

    await studyThrough({ isoDate: "2020-09-28", planId: plan.id });
    const week = await thisWeek();

    setToday("2020-09-29");
    await outline({ chapterId, count: 5, from: 5, skillId: law });
    await refreshGoalPlan({ goalId: goal.id });

    await expect(thisWeek()).resolves.toStrictEqual(week);
  });
});
