import { type MindMapStructure } from "@zoonk/ai/tasks/mind-maps/schema";
import { DbNull, prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIsolatedBudgetDay } from "../_test-utils/isolated-budget-day";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { getUsagePeriodStarts, getUsageResets } from "../entitlements/_utils/usage-periods";
import { GUEST_DAILY_SPEND_BUDGET_MICROS, getEstimatedCostMicros } from "../entitlements/limits";
import { courseGoalFixture, signedInCourseGoal } from "../view-models/_test-utils/course-goal";
import { getChapterMindMap } from "./get-chapter-mind-map";
import { listChapterLessonMaps } from "./list-chapter-lesson-maps";
import { listGoalMindMaps } from "./list-goal-mind-maps";
import { requestChapterMindMap } from "./request-chapter-mind-map";
import { requestGoalMindMaps } from "./request-goal-mind-maps";
import { saveMindMap } from "./save-mind-map";

const structure: MindMapStructure = {
  branches: ["Atoms", "Nucleus", "Electrons"].map((title) => ({
    drawing: `a drawing of ${title}`,
    explanation: `${title} in one line.`,
    points: [title],
    title,
  })),
  centralIdea: "Matter is made of atoms.",
  comparison: null,
  summary: "Atoms have a nucleus and electrons.",
  title: "The very small world",
};

const lessonMap = { ideas: [{ text: "Atoms are tiny." }] };

function writeLessons(lessonIds: readonly string[]) {
  return prisma.lesson.updateMany({
    data: { contentStatus: "completed", summary: lessonMap },
    where: { id: { in: [...lessonIds] } },
  });
}

function drawMap(chapterId: string) {
  return prisma.chapterMindMap.create({
    data: { chapterId, language: "en", status: "completed", structure },
  });
}

async function readyList(goalId: string) {
  const result = await listGoalMindMaps({ goalId });

  if (result.status !== "ready") {
    throw new Error(`The mind maps didn't read: ${result.status}`);
  }

  return result.mindMaps;
}

/** A course goal whose two plan chapters and the course's third chapter, outside the plan, are written. */
async function writtenCourseGoal() {
  const fixture = await signedInCourseGoal();
  const extra = await libraryLessonFixture({ title: "Waves in one lesson" });

  await chapterLessonFixture({ chapterId: fixture.beginner.id, lessonId: extra.id, position: 0 });
  await writeLessons([...fixture.lessons, extra].map((lesson) => lesson.id));

  const [first, second] = fixture.chapters;

  return { ...fixture, extra, first: first?.id ?? "", second: second?.id ?? "" };
}

function countMapClaims(userId: string) {
  return prisma.usageRecord.count({ where: { kind: "mindMap", userId } });
}

describe("mind maps study page", () => {
  it("covers every chapter of a course goal's course, in or out of its plan", async () => {
    const { beginner, extra, first, goal, second } = await writtenCourseGoal();

    const list = await readyList(goal.id);

    expect(list.chapters.map((chapter) => chapter.chapterId)).toStrictEqual([
      first,
      second,
      beginner.id,
    ]);

    await expect(
      getChapterMindMap({ chapterId: beginner.id, goalId: goal.id }),
    ).resolves.toMatchObject({
      mindMap: { chapterId: beginner.id, status: "available" },
      status: "ready",
    });

    await expect(
      listChapterLessonMaps({ chapterId: beginner.id, goalId: goal.id }),
    ).resolves.toMatchObject({
      lessonMaps: { lessons: [{ lessonId: extra.id, locked: false, map: lessonMap }] },
      status: "ready",
    });

    await expect(
      requestChapterMindMap({ chapterId: beginner.id, goalId: goal.id }),
    ).resolves.toStrictEqual({ generationId: null, status: "drawing" });
  });

  it("keeps an exam goal to its plan's chapters", async () => {
    const { beginner, goal } = await writtenCourseGoal();
    await prisma.goal.update({ data: { kind: "exam" }, where: { id: goal.id } });

    const list = await readyList(goal.id);

    expect(list.chapters.map((chapter) => chapter.chapterId)).not.toContain(beginner.id);

    await expect(
      getChapterMindMap({ chapterId: beginner.id, goalId: goal.id }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });

  it("counts and lists every written lesson's published map, never a staged or unwritten one", async () => {
    const { beginner, first, goal, lessons, second } = await writtenCourseGoal();
    const [labelless, staged, unwritten, broken] = lessons;

    await Promise.all([
      prisma.lesson.update({
        data: { stagedSummary: lessonMap, summary: DbNull },
        where: { id: staged?.id },
      }),
      prisma.lesson.update({ data: { contentStatus: "pending" }, where: { id: unwritten?.id } }),
      prisma.lesson.update({ data: { summary: { ideas: [] } }, where: { id: broken?.id } }),
    ]);

    const list = await readyList(goal.id);

    expect(list.lessonGroups).toStrictEqual([
      { chapterId: first, count: 1, locked: 0 },
      { chapterId: beginner.id, count: 1, locked: 0 },
    ]);

    expect(list.firstTab).toBe("lessons");

    await expect(
      listChapterLessonMaps({ chapterId: first, goalId: goal.id }),
    ).resolves.toMatchObject({
      lessonMaps: {
        chapter: { id: first, position: 1 },
        lessons: [
          { lessonId: labelless?.id, map: { ideas: [{ text: "Atoms are tiny." }] }, position: 1 },
        ],
      },
    });

    await expect(
      listChapterLessonMaps({ chapterId: second, goalId: goal.id }),
    ).resolves.toMatchObject({ lessonMaps: { lessons: [] } });

    await drawMap(first);

    await expect(readyList(goal.id)).resolves.toMatchObject({ firstTab: "chapters" });
  });

  it("saves a map once, lists saves in syllabus order, and removes them", async () => {
    const { extra, first, goal, lessons } = await writtenCourseGoal();
    const lessonId = lessons[0]?.id ?? "";
    await drawMap(first);

    const asks = [
      { goalId: goal.id, kind: "lesson", saved: true, targetId: extra.id },
      { goalId: goal.id, kind: "chapter", saved: true, targetId: first },
      { goalId: goal.id, kind: "chapter", saved: true, targetId: first },
      { goalId: goal.id, kind: "lesson", saved: true, targetId: lessonId },
    ] as const;

    const saves = await Promise.all(asks.map((ask) => saveMindMap(ask)));

    expect(saves).toStrictEqual(asks.map(() => ({ saved: true, status: "ready" })));
    await expect(prisma.savedMindMap.count({ where: { goalId: goal.id } })).resolves.toBe(3);

    const list = await readyList(goal.id);

    expect(list.chapters[0]).toMatchObject({ chapterId: first, saved: true });

    expect(list.saved).toStrictEqual([
      {
        available: true,
        chapterId: first,
        kind: "chapter",
        targetId: first,
        title: "The very small world",
      },
      {
        available: true,
        chapterId: first,
        kind: "lesson",
        targetId: lessonId,
        title: lessons[0]?.title,
      },
      {
        available: true,
        chapterId: list.chapters[2]?.chapterId,
        kind: "lesson",
        targetId: extra.id,
        title: extra.title,
      },
    ]);

    await expect(getChapterMindMap({ chapterId: first, goalId: goal.id })).resolves.toMatchObject({
      mindMap: { saved: true },
    });

    await expect(
      listChapterLessonMaps({ chapterId: first, goalId: goal.id }),
    ).resolves.toMatchObject({
      lessonMaps: { lessons: [{ lessonId, saved: true }, { saved: false }] },
    });

    await expect(
      saveMindMap({ goalId: goal.id, kind: "chapter", saved: false, targetId: first }),
    ).resolves.toStrictEqual({ saved: false, status: "ready" });

    await expect(
      saveMindMap({ goalId: goal.id, kind: "chapter", saved: false, targetId: first }),
    ).resolves.toStrictEqual({ saved: false, status: "ready" });

    const after = await readyList(goal.id);

    expect(after.saved.map((save) => save.targetId)).toStrictEqual([lessonId, extra.id]);
  });

  it("saves only a map that opens, and keeps this goal's saves that no longer open under their saved titles", async () => {
    const { course, first, goal, second } = await writtenCourseGoal();
    await drawMap(first);

    await expect(
      saveMindMap({ goalId: goal.id, kind: "chapter", saved: true, targetId: second }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      saveMindMap({ goalId: goal.id, kind: "lesson", saved: true, targetId: goal.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await saveMindMap({ goalId: goal.id, kind: "chapter", saved: true, targetId: first });

    await Promise.all([
      prisma.planItem.deleteMany({ where: { chapterId: first } }),
      prisma.courseChapter.deleteMany({ where: { chapterId: first, courseId: course.id } }),
      prisma.chapter.update({ data: { title: "Renamed" }, where: { id: first } }),
    ]);

    const list = await readyList(goal.id);

    expect(list.chapters.map((chapter) => chapter.chapterId)).not.toContain(first);

    expect(list.saved).toStrictEqual([
      {
        available: false,
        chapterId: null,
        kind: "chapter",
        targetId: first,
        title: "The very small world",
      },
    ]);

    await expect(
      saveMindMap({ goalId: goal.id, kind: "chapter", saved: false, targetId: first }),
    ).resolves.toStrictEqual({ saved: false, status: "ready" });

    await expect(readyList(goal.id)).resolves.toMatchObject({ saved: [] });
  });
});

describe("making all of a goal's chapter maps", () => {
  it("starts maps in course order within the allowance, as its offer said, and owes each run as admitted", async () => {
    const { beginner, first, goal, second, user } = await writtenCourseGoal();

    await usageRecordsFixture({
      count: 2,
      createdAt: new Date(),
      kind: "mindMap",
      userId: user.id,
    });

    const stop = {
      period: "day",
      reason: "limitReached",
      resetsAt: getUsageResets(new Date()).day.toISOString(),
      resource: "mindMap",
    };

    await expect(readyList(goal.id)).resolves.toMatchObject({
      createOffer: { eligible: 3, needLessons: 0, startable: 1, stop },
    });

    await expect(requestGoalMindMaps({ goalId: goal.id })).resolves.toStrictEqual({
      generations: {
        accepted: [first],
        joined: [],
        stop,
        unstarted: [
          { chapterId: second, reason: "allowance" },
          { chapterId: beginner.id, reason: "allowance" },
        ],
      },
      status: "ready",
    });

    await expect(countMapClaims(user.id)).resolves.toBe(3);

    await expect(
      prisma.chapterMindMap.findMany({
        select: { chapterId: true },
        where: { chapterId: { in: [first, second, beginner.id] }, status: "running" },
      }),
    ).resolves.toStrictEqual([{ chapterId: first }]);

    await expect(
      prisma.followUp.findMany({
        select: { input: true, key: true, kind: true },
        where: { userId: user.id },
      }),
    ).resolves.toStrictEqual([
      {
        input: {
          chapterId: first,
          goalId: goal.id,
          launch: {
            analytics: { distinctId: user.id, goalId: goal.id, platform: null },
            forExam: false,
            lessonIds: [],
          },
        },
        key: first,
        kind: "makeChapterMindMap",
      },
    ]);

    await expect(readyList(goal.id)).resolves.toMatchObject({
      chapters: [{ status: "drawing" }, { status: "available" }, { status: "available" }],
      createOffer: { eligible: 2, startable: 0 },
    });
  });

  it("keeps an admitted map on its way until its run starts, however late that is", async () => {
    const { first, goal } = await writtenCourseGoal();

    await requestGoalMindMaps({ goalId: goal.id });

    await prisma.chapterMindMap.update({
      data: { updatedAt: new Date("2026-01-01T00:00:00Z") },
      where: { chapterId: first },
    });

    await expect(readyList(goal.id)).resolves.toMatchObject({
      chapters: [{ chapterId: first, status: "drawing" }, {}, {}],
    });
  });

  it("leaves a chapter whose lessons aren't written to its own request, and a ready one alone", async () => {
    const { beginner, first, goal, lessons, second } = await writtenCourseGoal();
    await drawMap(first);

    await prisma.lesson.update({
      data: { contentStatus: "pending" },
      where: { id: lessons[2]?.id },
    });

    await expect(readyList(goal.id)).resolves.toMatchObject({
      createOffer: { eligible: 1, needLessons: 1, startable: 1, stop: null },
    });

    await expect(requestGoalMindMaps({ goalId: goal.id })).resolves.toMatchObject({
      generations: {
        accepted: [beginner.id],
        unstarted: [{ chapterId: second, reason: "needsLessons" }],
      },
    });
  });

  it("joins a map another learner is making and charges nothing on a second click", async () => {
    const { first, goal, lessons, user } = await writtenCourseGoal();
    const other = await userFixture();
    const otherGoal = await goalFixture({ userId: other.id });
    const plan = await planFixture({ goalId: otherGoal.id });

    await planItemFixture({
      chapterId: first,
      lessonId: lessons[0]?.id ?? null,
      planId: plan.id,
      position: 0,
    });

    await requestGoalMindMaps({ goalId: goal.id });
    await expect(countMapClaims(user.id)).resolves.toBe(3);

    mockSession(other.id);

    await expect(requestGoalMindMaps({ goalId: otherGoal.id })).resolves.toMatchObject({
      generations: { accepted: [], joined: [first], unstarted: [] },
    });

    await expect(countMapClaims(other.id)).resolves.toBe(0);

    mockSession(user.id);

    await expect(requestGoalMindMaps({ goalId: goal.id })).resolves.toMatchObject({
      generations: { accepted: [], unstarted: [] },
    });

    await expect(countMapClaims(user.id)).resolves.toBe(3);
  });
});

async function guestCourseGoal() {
  const guest = await userFixture();
  await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });
  const fixture = await courseGoalFixture({ userId: guest.id });
  await writeLessons(fixture.lessons.map((lesson) => lesson.id));
  mockGuestSession(guest.id);
  return { ...fixture, guest };
}

function readGuestSpend() {
  return prisma.guestSpendDay.findUnique({ where: { day: getUsagePeriodStarts(new Date()).day } });
}

describe("a guest making all chapter maps", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await useIsolatedBudgetDay();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("takes each map from the day all guests share", async () => {
    const { chapters, goal, guest } = await guestCourseGoal();

    await expect(requestGoalMindMaps({ goalId: goal.id })).resolves.toMatchObject({
      generations: {
        accepted: [chapters[0]?.id],
        stop: { period: "total", reason: "limitReached", resetsAt: null, resource: "mindMap" },
      },
    });

    await expect(countMapClaims(guest.id)).resolves.toBe(1);

    await expect(readGuestSpend()).resolves.toMatchObject({
      spentMicros: getEstimatedCostMicros({ generated: true, kind: "mindMap" }),
    });
  });

  it("starts nothing once the day all guests share is spent", async () => {
    await prisma.guestSpendDay.create({
      data: {
        day: getUsagePeriodStarts(new Date()).day,
        spentMicros: GUEST_DAILY_SPEND_BUDGET_MICROS,
      },
    });

    const { goal, guest } = await guestCourseGoal();

    await expect(requestGoalMindMaps({ goalId: goal.id })).resolves.toMatchObject({
      generations: {
        accepted: [],
        stop: { period: null, reason: "signUpRequired", resetsAt: null, resource: null },
      },
    });

    await expect(countMapClaims(guest.id)).resolves.toBe(0);
    await expect(prisma.followUp.count({ where: { userId: guest.id } })).resolves.toBe(0);
  });
});
