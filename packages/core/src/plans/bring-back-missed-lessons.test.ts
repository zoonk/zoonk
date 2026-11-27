import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { analytics } from "../_test-utils/test-boundaries";
import { unplannedGoalFixture } from "./_test-utils/plan-library";
import { loadCourseStarts } from "./_utils/course-starts";
import { announceTestedOutItems } from "./announce-tested-out-items";
import { bringBackMissedLessons } from "./bring-back-missed-lessons";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { type PlanGraph } from "./planner/plan-state";

const NOW = new Date("2026-10-12T12:00:00Z");

async function courseChapter({ skillId, titles }: { skillId: string; titles: string[] }) {
  const [course, chapter] = await Promise.all([courseFixture(), libraryChapterFixture()]);

  const lessons = await Promise.all(
    titles.map((title) =>
      libraryLessonFixture({ estimatedMinutes: 3, homeChapterId: chapter.id, title }),
    ),
  );

  await Promise.all([
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
    chapterSkillFixture({ chapterId: chapter.id, skillId }),
    ...lessons.flatMap((lesson, position) => [
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
      lessonSkillFixture({ lessonId: lesson.id, skillId }),
    ]),
  ]);

  return { course, lessons };
}

async function setup() {
  const user = await userFixture();
  const [known, missed] = await Promise.all([skillFixture(), skillFixture()]);
  const [prefix] = crypto.randomUUID().split("-");

  const [knownCourse, missedCourse] = await Promise.all([
    courseChapter({
      skillId: known.id,
      titles: [`Site map ${prefix}`, `Content groups ${prefix}`, `Labels ${prefix}`],
    }),
    courseChapter({
      skillId: missed.id,
      titles: [`Reading order ${prefix}`, `Visual weight ${prefix}`],
    }),
  ]);

  const [shared] = knownCourse.lessons;
  await lessonSkillFixture({ lessonId: shared?.id ?? "", skillId: missed.id });

  const graph: PlanGraph = {
    phases: [{ milestone: "Can design", name: "Basics" }],
    skills: [known, missed].map((skill, index) => ({
      area: "Design",
      courseIds: [index === 0 ? knownCourse.course.id : missedCourse.course.id],
      lessons: index === 0 ? 3 : 2,
      name: skill.name,
      phase: 0,
      skillId: skill.id,
      weight: null,
    })),
  };

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 30,
    settings: { startDate: "2026-10-12" },
    timezone: "UTC",
    userId: user.id,
  });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph });

  await prisma.planItem.updateMany({
    data: { completedAt: NOW, status: "testedOut" },
    where: { kind: "lesson", planId: plan.id },
  });

  return { goal, known, missed, plan, shared: shared?.id ?? "" };
}

describe(bringBackMissedLessons, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("brings back the lessons the plan teaches the missed topic, and leaves the others tested out", async () => {
    const { goal, missed, plan, shared } = await setup();

    await bringBackMissedLessons({
      goalId: goal.id,
      now: NOW,
      skillIds: [missed.id],
      timeZone: "UTC",
    });

    const items = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { kind: "lesson", planId: plan.id },
    });

    expect(items.find((item) => item.lessonId === shared)?.status).toBe("testedOut");

    expect(
      items.filter((item) => item.skillId === missed.id).map((item) => item.status),
    ).toStrictEqual(["todo", "todo"]);

    const positions = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      select: { position: true },
      where: { planId: plan.id },
    });

    expect(positions.map((item) => item.position)).toStrictEqual(
      positions.map((_, index) => index),
    );
  });

  it("returns a started-past topic on its first miss, once, with Undo", async () => {
    const { goal, known, missed, plan } = await setup();

    await prisma.planChange.create({
      data: {
        createdAt: new Date(NOW.getTime() - 60_000),
        kind: "testedOut",
        payload: { startedPastSkillIds: [known.id, missed.id] },
        planId: plan.id,
        reason: "Course placement",
        status: "applied",
      },
    });

    const flush = runDeferredWork();

    const restore = () =>
      bringBackMissedLessons({
        goalId: goal.id,
        livingPlanDay: "2026-10-12",
        now: NOW,
        skillIds: [missed.id],
        timeZone: "UTC",
      });

    const event = expect.objectContaining({
      name: "Course Placement Topic Restored",
      properties: { goal_id: goal.id, skill_id: missed.id },
    });

    await restore();
    await flush();
    expect(analytics.trackServerEvent).toHaveBeenCalledWith(event);
    analytics.trackServerEvent.mockClear();
    await restore();
    await flush();
    expect(analytics.trackServerEvent).not.toHaveBeenCalledWith(event);
    const starts = await loadCourseStarts(goal.id);
    expect([...starts.keys()]).toStrictEqual([known.id]);

    const change = await prisma.planChange.findFirstOrThrow({
      where: { kind: "relearn", planId: plan.id },
    });

    await expect(
      decidePlanChange({ changeId: change.id, goalId: goal.id, input: { status: "undone" } }),
    ).resolves.toMatchObject({ status: "updated" });

    const undone = await loadCourseStarts(goal.id);
    expect(undone.has(missed.id)).toBe(true);
  });

  it("batches failed re-checks for the shown day and undoes them without changing its queue", async () => {
    const { goal, known, missed, plan } = await setup();

    const session = await studySessionFixture({
      goalId: goal.id,
      status: "active",
      userId: goal.userId,
    });

    const shown = await Promise.all([
      studySessionBlockFixture({
        kind: "review",
        position: 0,
        sessionId: session.id,
        status: "active",
      }),
      studySessionBlockFixture({ position: 1, sessionId: session.id, status: "pending" }),
    ]);

    const apply = (skillId: string) =>
      bringBackMissedLessons({
        goalId: goal.id,
        livingPlanDay: "2026-10-12",
        now: NOW,
        skillIds: [skillId],
        timeZone: "UTC",
      });

    await apply(missed.id);
    await apply(known.id);
    await apply(known.id);

    const changes = await prisma.planChange.findMany({
      where: { kind: "relearn", planId: plan.id, status: "applied" },
    });

    expect(changes).toHaveLength(1);

    expect(changes[0]?.payload).toMatchObject({
      effect: {
        topicsAdded: [
          { area: "Design", topics: expect.arrayContaining([missed.name, known.name]) },
        ],
      },
    });

    const undo = await decidePlanChange({
      changeId: changes[0]?.id ?? "",
      goalId: goal.id,
      input: { status: "undone" },
    });

    expect(undo).toMatchObject({ change: { status: "undone" }, status: "updated" });

    const [blocks, items] = await Promise.all([
      prisma.studySessionBlock.findMany({
        orderBy: { position: "asc" },
        where: { sessionId: session.id },
      }),
      prisma.planItem.findMany({ where: { kind: "lesson", planId: plan.id } }),
    ]);

    expect(blocks).toStrictEqual(shown);
    expect(items.length).toBeGreaterThan(0);

    expect(items.every((item) => item.status === "testedOut")).toBe(true);
    expect(items.map((item) => item.completedAt)).toStrictEqual(items.map(() => NOW));
  });

  it("puts a skip and a failed re-check on one card with one Undo", async () => {
    const { goal, known, missed, plan } = await setup();
    const knownWhere = { kind: "lesson" as const, planId: plan.id, skillId: known.id };

    await prisma.planItem.updateMany({
      data: { completedAt: null, status: "todo" },
      where: knownWhere,
    });

    await bringBackMissedLessons({
      goalId: goal.id,
      livingPlanDay: "2026-10-12",
      now: NOW,
      skillIds: [missed.id],
      timeZone: "UTC",
    });

    const skipped = await prisma.planItem.updateManyAndReturn({
      data: { completedAt: NOW, status: "testedOut" },
      where: knownWhere,
    });

    const result = await announceTestedOutItems({
      goalId: goal.id,
      livingPlanDay: "2026-10-12",
      now: NOW,
      planItemIds: skipped.map((item) => item.id),
      timeZone: "UTC",
    });

    const changes = await prisma.planChange.findMany({
      where: { kind: { in: ["relearn", "testedOut"] }, planId: plan.id, status: "applied" },
    });

    expect(changes).toHaveLength(1);
    expect(result?.changeId).toBe(changes[0]?.id);

    expect(changes[0]?.payload).toMatchObject({
      effect: {
        topicsAdded: [{ area: "Design", topics: [missed.name] }],
        topicsLeftOut: [{ area: "Design", topics: [known.name] }],
      },
      lessonsSkipped: skipped.length,
    });

    await expect(
      decidePlanChange({
        changeId: changes[0]?.id ?? "",
        goalId: goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toMatchObject({ change: { status: "undone" }, status: "updated" });

    const items = await prisma.planItem.findMany({ where: { kind: "lesson", planId: plan.id } });

    expect(
      items.filter((item) => item.skillId === known.id).every((item) => item.status === "todo"),
    ).toBe(true);

    expect(
      items
        .filter((item) => item.skillId === missed.id)
        .every((item) => item.status === "testedOut"),
    ).toBe(true);
  });
});
