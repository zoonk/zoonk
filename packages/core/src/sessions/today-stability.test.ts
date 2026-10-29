import { type GenerationStatus, prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { replanGoalsWaitingOnSkills } from "../library/curriculum/replan-waiting-goals";
import { askTodayOutlines } from "../lookahead/today-outlines";
import { keepPaceOwn } from "../plans/_test-utils/keep-pace-own";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { readSelectedItemFacts } from "../plans/_utils/selected-item-contract";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getTodayView } from "../view-models/today/get-today-view";
import { getTodayStudySession } from "./_test-utils/open-today";
import { openTodayView } from "./_test-utils/open-today-view";
import { daysAgo, dueSkillFixture } from "./_test-utils/session-goal";

const NOW = new Date("2026-09-30T12:00:00Z");
const A_MINUTE_LATER = new Date("2026-09-30T12:01:00Z");
const TODAY = new Date("2026-09-30T00:00:00Z");
const LANDING = 4;

type Library = Awaited<ReturnType<typeof planLibraryFixture>>;

async function readToday(goalId: string) {
  const result = await getTodayStudySession({ goalId, timeZone: "UTC" });

  if (result.status !== "ready") {
    throw new Error(`Expected a session, got ${result.status}`);
  }

  return result.session;
}

async function setupDayWithStandIn({
  dailyMinutes = 45,
  firstLessons = 2,
  laterLessons = 8,
  outlineStatus = "running",
  standInSize = LANDING,
}: {
  dailyMinutes?: number;
  firstLessons?: number;
  laterLessons?: number;
  outlineStatus?: GenerationStatus;
  standInSize?: number;
} = {}) {
  const [user, course] = await Promise.all([userFixture(), courseFixture({ outlineStatus })]);

  const library = await planLibraryFixture({
    skills: [
      ...(firstLessons > 0 ? [{ lessons: firstLessons }] : []),
      { lessons: 0, size: standInSize },
      { lessons: laterLessons },
    ],
  });

  const { goal } = await unplannedGoalFixture({
    dailyMinutes,
    primaryCourseId: course.id,
    settings: { startDate: "2026-09-30" },
    timezone: "UTC",
    userId: user.id,
  });

  await Promise.all([
    createGoalPlan({ goalId: goal.id, graph: library.graph }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  mockSession(user.id);

  return { course, goal, library };
}

/** A placement tested out every written lesson, so the day holds only practice and nobody outlines its next lessons. */
async function setupPlacedDay() {
  const [user, course] = await Promise.all([
    userFixture(),
    courseFixture({ outlineStatus: "completed" }),
  ]);

  const library = await planLibraryFixture({
    skills: [{ lessons: 3 }, { builds: 0, lessons: 0, size: 8 }],
  });

  const known = library.skills[0]?.id ?? "";

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 30,
    primaryCourseId: course.id,
    settings: { startDate: "2026-09-30" },
    timezone: "UTC",
    userId: user.id,
  });

  await Promise.all([
    createGoalPlan({ goalId: goal.id, graph: library.graph }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    itemFixture({ content: choiceItemContent(), skillId: known }),
    dueSkillFixture({ due: daysAgo(-10), skillId: known, userId: user.id }),
  ]);

  await prisma.planItem.updateMany({
    data: { completedAt: NOW, status: "testedOut" },
    where: { lessonId: { not: null }, plan: { goalId: goal.id } },
  });

  mockSession(user.id);

  return { goal };
}

async function landWaitingLessons({
  count = LANDING,
  courseId,
  library,
}: {
  count?: number;
  courseId: string;
  library: Library;
}): Promise<string[]> {
  const [chapter] = library.chapters;
  const skillId = library.skills[1]?.id ?? "";

  const lessons = await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const lesson = await libraryLessonFixture({
        estimatedMinutes: 3,
        homeChapterId: chapter?.id ?? null,
        title: `Landed lesson ${index + 1} ${crypto.randomUUID()}`,
      });

      await Promise.all([
        chapterLessonFixture({
          chapterId: chapter?.id ?? "",
          lessonId: lesson.id,
          position: 150 + index,
        }),
        lessonSkillFixture({ lessonId: lesson.id, skillId }),
      ]);

      return lesson.id;
    }),
  );

  await replanGoalsWaitingOnSkills({ skillIds: [skillId] });
  await prisma.course.update({ data: { outlineStatus: "completed" }, where: { id: courseId } });

  return lessons;
}

function learnLessonIds(session: Awaited<ReturnType<typeof readToday>>): string[] {
  return session.blocks.flatMap((block) =>
    block.kind === "learn" && block.lessonId ? [block.lessonId] : [],
  );
}

describe("today's session the learner was shown", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    // Exact allocations use this learner's pace, independent of other tests' completed lessons.
    await keepPaceOwn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("holds the place of lessons still being outlined, says they're on the way, and keeps every block it showed when they land", async () => {
    const { course, goal, library } = await setupDayWithStandIn();
    const before = await readToday(goal.id);

    const dueToday = await prisma.planItem.findMany({
      where: { lessonId: { not: null }, plan: { goalId: goal.id } },
    });

    const allocated = dueToday.filter(
      (item) =>
        (item.scheduledFor !== null && item.scheduledFor <= TODAY) ||
        readSelectedItemFacts(item.facts)?.days?.some(
          ([date, , raw]) => date === "2026-09-30" && raw > 0,
        ),
    );

    const due = new Set(allocated.map((item) => item.lessonId));

    const spanning = allocated.find(
      (item) => item.scheduledFor !== null && item.scheduledFor > TODAY,
    );

    expect(readSelectedItemFacts(spanning?.facts)?.days).toStrictEqual([
      ["2026-09-30", 1, 0.5],
      ["2026-10-01", 5, 2.5],
    ]);

    expect(learnLessonIds(before).length).toBeGreaterThan(0);
    expect(learnLessonIds(before).filter((id) => !due.has(id))).toStrictEqual([]);
    expect(before.lessonsComing).toBe(true);

    vi.setSystemTime(A_MINUTE_LATER);
    const landed = await landWaitingLessons({ courseId: course.id, library });
    const after = await readToday(goal.id);

    expect(after.lessonsComing).toBe(false);
    expect(after.id).toBe(before.id);

    expect(after.blocks.every((block) => block.status === "pending")).toBe(true);
    expect(learnLessonIds(after)).toStrictEqual(expect.arrayContaining(learnLessonIds(before)));
    expect(learnLessonIds(after)).toStrictEqual(expect.arrayContaining(landed));
    expect(after.minutes.planned).toBeLessThanOrEqual(goal.dailyMinutes);
  });

  it("says more lessons are on the way when the stand-in starting in the day is due a day later", async () => {
    const { goal } = await setupDayWithStandIn({ standInSize: 20 });

    const dueToday = await prisma.planItem.count({
      where: { lessonId: null, plan: { goalId: goal.id }, scheduledFor: { lte: TODAY } },
    });

    const today = await readToday(goal.id);

    expect(dueToday).toBe(0);
    expect(learnLessonIds(today).length).toBeGreaterThan(0);
    expect(today.lessonsComing).toBe(true);
  });

  it("fills the day as usual when no one is outlining the lessons it waits for", async () => {
    const { goal, library } = await setupDayWithStandIn({ outlineStatus: "completed" });
    const later = new Set(library.lessons.slice(2).map((lesson) => lesson.id));
    const today = await readToday(goal.id);

    expect(today.lessonsComing).toBe(false);

    const dueToday = await prisma.planItem.findMany({
      where: { lessonId: { not: null }, plan: { goalId: goal.id }, scheduledFor: { lte: TODAY } },
    });

    const due = new Set(dueToday.map((item) => item.lessonId));

    expect(learnLessonIds(today).some((id) => later.has(id) && !due.has(id))).toBe(true);
  });

  it("says lessons are coming before the day opens only while someone is outlining them", async () => {
    const outlining = await setupDayWithStandIn({ laterLessons: 0 });
    const whileOutlining = await getTodayView({ goalId: outlining.goal.id, timeZone: "UTC" });

    expect(whileOutlining.status === "ready" && whileOutlining.today.session).toMatchObject({
      lessonsComing: true,
      status: "unstarted",
    });

    const idle = await setupDayWithStandIn({ laterLessons: 0, outlineStatus: "completed" });
    const whileIdle = await getTodayView({ goalId: idle.goal.id, timeZone: "UTC" });

    expect(whileIdle.status === "ready" && whileIdle.today.session).toMatchObject({
      lessonsComing: false,
      status: "unstarted",
    });
  });

  it("asks for an empty day's lessons nobody is outlining, and says they're coming once asked", async () => {
    const { goal } = await setupDayWithStandIn({
      firstLessons: 0,
      laterLessons: 0,
      outlineStatus: "completed",
    });

    const before = await getTodayView({ goalId: goal.id, timeZone: "UTC" });

    expect(before.status === "ready" && before.today.session).toMatchObject({
      blocks: [],
      emptyDay: "lessonsToPrepare",
      status: "unstarted",
    });

    const opened = await openTodayView({ goalId: goal.id, timeZone: "UTC" });

    expect(opened.today.session).toMatchObject({ blocks: [], emptyDay: "lessonsToPrepare" });

    await askTodayOutlines({ goalId: goal.id, timeZone: "UTC" });
    const after = await openTodayView({ goalId: goal.id, timeZone: "UTC" });

    expect(after.today.session).toMatchObject({ blocks: [], emptyDay: "lessonsComing" });
  });

  it("asks for a practice-only day's lessons nobody is outlining, and says they're coming once asked", async () => {
    const { goal } = await setupPlacedDay();
    const before = await getTodayView({ goalId: goal.id, timeZone: "UTC" });
    const day = before.status === "ready" ? before.today.session : null;

    expect(day?.blocks.length).toBeGreaterThan(0);
    expect(day?.blocks.some((block) => block.kind === "learn")).toBe(false);

    expect(day).toMatchObject({
      lessonsComing: false,
      lessonsToPrepare: true,
      status: "unstarted",
    });

    const opened = await openTodayView({ goalId: goal.id, timeZone: "UTC" });

    expect(opened.today.session).toMatchObject({ lessonsComing: false, lessonsToPrepare: true });

    await askTodayOutlines({ goalId: goal.id, timeZone: "UTC" });
    const after = await openTodayView({ goalId: goal.id, timeZone: "UTC" });

    expect(after.today.session).toMatchObject({ lessonsComing: true, lessonsToPrepare: false });
  });

  it("stops waiting on an outline nobody has touched for a while", async () => {
    const { course, goal } = await setupDayWithStandIn({
      firstLessons: 0,
      laterLessons: 0,
      outlineStatus: "pending",
    });

    const fresh = await getTodayView({ goalId: goal.id, timeZone: "UTC" });

    await prisma.course.update({
      data: { updatedAt: new Date(NOW.getTime() - 20 * 60_000) },
      where: { id: course.id },
    });

    const stale = await getTodayView({ goalId: goal.id, timeZone: "UTC" });

    expect(fresh.status === "ready" && fresh.today.session.emptyDay).toBe("lessonsComing");
    expect(stale.status === "ready" && stale.today.session.emptyDay).toBe("lessonsToPrepare");
  });

  it("fills the rest of the day once the outline it waited for ends without its lessons", async () => {
    const { course, goal } = await setupDayWithStandIn();
    const before = await readToday(goal.id);

    expect(before.lessonsComing).toBe(true);

    await prisma.course.update({ data: { outlineStatus: "completed" }, where: { id: course.id } });
    const after = await readToday(goal.id);

    expect(after.lessonsComing).toBe(false);

    expect(after.blocks.slice(0, before.blocks.length).map((block) => block.id)).toStrictEqual(
      before.blocks.map((block) => block.id),
    );

    expect(after.blocks.length).toBeGreaterThan(before.blocks.length);
  });

  it("plans what the shown day can't hold on later days, not as work the day left", async () => {
    const { course, goal, library } = await setupDayWithStandIn();
    await readToday(goal.id);
    await landWaitingLessons({ count: LANDING * 3, courseId: course.id, library });
    const today = await readToday(goal.id);
    const held = new Set(learnLessonIds(today));

    const dueToday = await prisma.planItem.findMany({
      where: {
        kind: { in: ["lesson", "chapter"] },
        plan: { goalId: goal.id },
        scheduledFor: { lte: TODAY },
        status: "todo",
      },
    });

    expect(
      dueToday
        .filter((item) => !item.lessonId || !held.has(item.lessonId))
        .map((item) => item.titleSnapshot),
    ).toStrictEqual([]);
  });
});
