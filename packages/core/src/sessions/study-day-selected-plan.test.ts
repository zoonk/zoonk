import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { markLearnerChanged, markPlansChanged } from "../learner/_utils/mark-learner-changed";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { readFreshPlanSummary } from "../plans/_utils/plan-summary";
import { createGoalPlan } from "../plans/create-goal-plan";
import * as producer from "../plans/planner/build-plan";
import { getTodayView } from "../view-models/today/get-today-view";
import { SESSION_NOW } from "./_test-utils/session-goal";
import { toDayBlockRef } from "./day-block";
import { getSessionPageView } from "./get-session-page-view";
import { openStudyDay } from "./open-study-day";

async function setup(startDate = "2026-09-30") {
  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({ skills: [{ lessons: 3 }, { lessons: 2 }] }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: new Date(`${startDate}T12:00:00Z`),
    dailyMinutes: 30,
    details: { placementDeclined: true },
    settings: { startDate },
    targetDate: new Date("2026-10-20"),
    timezone: "UTC",
    userId: user.id,
  });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);

  await expect(
    createGoalPlan({ goalId: goal.id, graph: library.graph, setup: "steps" }),
  ).resolves.toMatchObject({ status: "created" });

  return {
    goal,
    input: { goalId: goal.id, shownDate: startDate, timeZone: "UTC" },
    library,
    plan,
    user,
  };
}

async function saved(planId: string) {
  return prisma.plan.findUniqueOrThrow({
    include: { items: { orderBy: { position: "asc" } } },
    where: { id: planId },
  });
}

function assertFresh(plan: Awaited<ReturnType<typeof saved>>, userId: string) {
  expect(
    readFreshPlanSummary({
      basis: {
        inputVersion: plan.inputVersion,
        planId: plan.id,
        planVersion: plan.version,
        studyDay: "2026-09-30",
        timeZone: "UTC",
        userId,
      },
      value: plan.summary,
    }),
  ).not.toBeNull();
}

describe("a selected plan reaches the day exactly once", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("reads the current saved plan without a build and opens the exact same work", async () => {
    const fixture = await setup();
    const before = await saved(fixture.plan.id);
    assertFresh(before, fixture.user.id);
    // Calls through to the real pure producer: count builds, never replace persistence or results.
    const builds = vi.spyOn(producer, "buildPlan");
    const preview = await countDatabaseStatements(() => getSessionPageView(fixture.input));
    expect(preview.writes).toBe(0);
    expect(builds).toHaveBeenCalledTimes(0);

    if (preview.result.status !== "unstarted") {
      throw new Error("Expected the actual current saved plan preview");
    }

    const opened = await openStudyDay(fixture.input);

    if (opened.status !== "opened") {
      throw new Error("Expected the learner's day to open");
    }

    expect(builds).toHaveBeenCalledTimes(0);

    expect(opened.session.blocks.map((block) => toDayBlockRef(block))).toStrictEqual(
      preview.result.day.blocks.map((block) => toDayBlockRef(block)),
    );

    const after = await saved(fixture.plan.id);
    expect(after.items).toStrictEqual(before.items);
    expect(after.inputVersion).toBe(before.inputVersion + 1);
    assertFresh(after, fixture.user.id);
  });

  it("builds a stale day once in memory, then once on its separate POST and saves fresh facts atomically", async () => {
    const fixture = await setup();

    await prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { planInputs: true, userId: fixture.user.id });
      await tx.goal.update({ data: { dailyMinutes: 25 }, where: { id: fixture.goal.id } });
    });

    const before = await saved(fixture.plan.id);
    const builds = vi.spyOn(producer, "buildPlan");
    const preview = await countDatabaseStatements(() => getSessionPageView(fixture.input));
    expect(preview.writes).toBe(0);
    expect(builds).toHaveBeenCalledOnce();
    await expect(saved(fixture.plan.id)).resolves.toStrictEqual(before);
    const opened = await openStudyDay(fixture.input);
    expect(opened.status).toBe("opened");
    expect(builds).toHaveBeenCalledTimes(2);
    const after = await saved(fixture.plan.id);
    assertFresh(after, fixture.user.id);
    await getSessionPageView(fixture.input);
    expect(builds).toHaveBeenCalledTimes(2);
  });

  it("keeps today's displayed work when new lessons land between preview and open", async () => {
    const fixture = await setup();
    const preview = await getSessionPageView(fixture.input);

    if (preview.status !== "unstarted") {
      throw new Error("Expected the real unopened preview before content landed");
    }

    const firstSkill = fixture.library.skills[0];

    if (!firstSkill) {
      throw new Error("Expected an owned library skill");
    }

    const landed = await libraryLessonFixture({
      estimatedMinutes: 3,
      title: "Newly landed lesson",
    });

    await lessonSkillFixture({ lessonId: landed.id, skillId: firstSkill.id });
    await prisma.$transaction((tx) => markPlansChanged(tx, { planIds: [fixture.plan.id] }));
    const opened = await openStudyDay(fixture.input);

    if (opened.status !== "opened") {
      throw new Error("Expected the day to open after the new content arrived");
    }

    expect
      .soft(opened.session.blocks.map((block) => toDayBlockRef(block)))
      .toStrictEqual(preview.day.blocks.map((block) => toDayBlockRef(block)));

    expect.soft(opened.session.blocks.map((block) => block.lessonId)).not.toContain(landed.id);
    const savedPlan = await saved(fixture.plan.id);
    const future = savedPlan.items.find((item) => item.lessonId === landed.id);

    expect(
      future?.scheduledFor,
      "The producer's actual date for the newly landed lesson",
    ).toBeDefined();

    expect(future?.scheduledFor?.getTime()).toBeGreaterThan(new Date("2026-09-30").getTime());
  });

  it("keeps the shown overdue day on a forced stale rebuild after a lesson lands", async () => {
    vi.setSystemTime(new Date("2026-09-29T12:00:00Z"));
    const fixture = await setup("2026-09-29");
    vi.setSystemTime(SESSION_NOW);
    const input = { ...fixture.input, shownDate: "2026-09-30" };
    const builds = vi.spyOn(producer, "buildPlan");
    const preview = await getSessionPageView(input);

    if (preview.status !== "unstarted") {
      throw new Error("Expected the actual overdue preview");
    }

    expect(builds).toHaveBeenCalledOnce();
    expect(builds.mock.calls[0]?.[0].mode).toBe("forced");
    const firstSkill = fixture.library.skills[0];

    if (!firstSkill) {
      throw new Error("Expected the owned first skill");
    }

    const landed = await libraryLessonFixture({ estimatedMinutes: 3 });
    await lessonSkillFixture({ lessonId: landed.id, skillId: firstSkill.id });
    await prisma.$transaction((tx) => markPlansChanged(tx, { planIds: [fixture.plan.id] }));
    const opened = await openStudyDay(input);

    if (opened.status !== "opened") {
      throw new Error("Expected the forced day to open");
    }

    expect(opened.session.blocks.map((block) => toDayBlockRef(block))).toStrictEqual(
      preview.day.blocks.map((block) => toDayBlockRef(block)),
    );

    expect(opened.session.blocks.map((block) => block.lessonId)).not.toContain(landed.id);
  });

  it("Today's stale preview counts the exact visible work without another planner build", async () => {
    const fixture = await setup();

    await prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { planInputs: true, userId: fixture.user.id });
      await tx.goal.update({ data: { dailyMinutes: 25 }, where: { id: fixture.goal.id } });
    });

    const builds = vi.spyOn(producer, "buildPlan");
    const today = await getTodayView(fixture.input);

    if (today.status !== "ready") {
      throw new Error("Expected the actual stale Today preview");
    }

    const lessons = today.today.session.blocks.filter(
      (block) => block.kind === "learn" && !block.reinforcement,
    );

    expect(lessons.length).toBeGreaterThan(0);
    expect(today.today.progress).toMatchObject({ lessons: { today: lessons.length } });
    expect(builds).toHaveBeenCalledOnce();

    await expect(prisma.studySession.count({ where: { goalId: fixture.goal.id } })).resolves.toBe(
      0,
    );
  });

  it.each(["deleted", "unpublished"] as const)(
    "drops %s shown content honestly without substituting newly landed work",
    async (kind) => {
      const fixture = await setup();
      const preview = await getSessionPageView(fixture.input);

      if (preview.status !== "unstarted") {
        throw new Error("Expected the actual shown day");
      }

      const first = preview.day.blocks.find((block) => block.kind === "learn" && block.lessonId);

      if (!first?.lessonId) {
        throw new Error("Expected an actual owned shown lesson");
      }

      await prisma.$transaction(async (tx) => {
        await markPlansChanged(tx, { planIds: [fixture.plan.id] });

        if (kind === "deleted") {
          await tx.lesson.delete({ where: { id: first.lessonId ?? "" } });
        } else {
          await tx.lesson.update({
            data: { setAsideAt: SESSION_NOW },
            where: { id: first.lessonId ?? "" },
          });
        }
      });

      const opened = await openStudyDay({
        ...fixture.input,
        target: { kind: "ref", ref: toDayBlockRef(first) },
      });

      if (opened.status !== "opened") {
        throw new Error("Expected the remaining day to open");
      }

      expect(opened.target).toBeNull();
      expect(opened.targetStatus).toBe("gone");

      expect(opened.session.blocks.map((block) => toDayBlockRef(block))).toStrictEqual(
        preview.day.blocks
          .filter((block) => block !== first)
          .map((block) => toDayBlockRef(block))
          .map((ref, position) => ({ ...ref, position })),
      );
    },
  );
});
