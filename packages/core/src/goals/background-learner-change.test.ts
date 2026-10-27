import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planChangeFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { safeAsync } from "@zoonk/utils/error";
import { describe, expect, it, vi } from "vitest";
import { setGoalPrimaryCourse } from "../library/curriculum/goal-primary-course";
import { linkGoalToExamBlueprint, unlinkGoalFromSharedExam } from "../library/exams/exam-learners";
import { recordGoalNoticeFormats } from "../library/exams/notice-formats";
import { followPlanToday } from "../plans/_utils/follow-plan-today";
import { loadPlanContext } from "../plans/_utils/plan-context";
import { claimNoticeLanding, endNoticeWait, startNoticeWait } from "../plans/notice-wait";
import { recordGoalBuildFailure, recordGoalGeneration } from "./record-goal-generation";

async function setup() {
  const user = await userFixture();
  const goal = await goalFixture({ details: { kept: "answer" }, kind: "exam", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });
  return { goal, plan, user };
}

async function stamp(userId: string, planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  return { inputVersion: plan.inputVersion };
}

describe("background goal plan marks", () => {
  it("marks the generation run and cleared failure once, without changing planning inputs", async () => {
    const { goal, plan, user } = await setup();
    await prisma.plan.update({ data: { buildFailedAt: new Date() }, where: { id: plan.id } });
    const before = await stamp(user.id, plan.id);
    const input = { generationId: randomUUID(), goalId: goal.id };
    await Promise.all([recordGoalGeneration(input), recordGoalGeneration(input)]);

    await expect(stamp(user.id, plan.id)).resolves.toStrictEqual({ ...before });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      buildFailedAt: null,
    });

    await recordGoalGeneration({ ...input, goalId: randomUUID() });

    await expect(stamp(user.id, plan.id)).resolves.toStrictEqual({ ...before });
  });

  it("marks a build failure once and leaves a missing goal alone", async () => {
    const { goal, plan, user } = await setup();
    const before = await stamp(user.id, plan.id);
    await Promise.all([recordGoalBuildFailure(goal.id), recordGoalBuildFailure(goal.id)]);

    await expect(stamp(user.id, plan.id)).resolves.toStrictEqual({ ...before });

    await recordGoalBuildFailure(randomUUID());
  });

  it("serializes competing primary course links and keeps the first choice", async () => {
    const [{ goal, plan, user }, first, second] = await Promise.all([
      setup(),
      courseFixture(),
      courseFixture(),
    ]);

    const before = await stamp(user.id, plan.id);

    await Promise.all([
      setGoalPrimaryCourse({ courseId: first.id, goalId: goal.id }),
      setGoalPrimaryCourse({ courseId: second.id, goalId: goal.id }),
    ]);

    await expect(stamp(user.id, plan.id)).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 1,
    });

    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect([first.id, second.id]).toContain(saved.primaryCourseId);
  });

  it("marks blueprint link and unlink, while duplicate requests and private unlinks do nothing", async () => {
    const [{ goal, plan, user }, blueprint] = await Promise.all([setup(), examBlueprintFixture()]);
    const before = await stamp(user.id, plan.id);

    await Promise.all([
      linkGoalToExamBlueprint({ examBlueprintId: blueprint.id, goalId: goal.id }),
      linkGoalToExamBlueprint({ examBlueprintId: blueprint.id, goalId: goal.id }),
    ]);

    await expect(stamp(user.id, plan.id)).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 1,
    });

    await Promise.all([unlinkGoalFromSharedExam(goal.id), unlinkGoalFromSharedExam(goal.id)]);

    await expect(stamp(user.id, plan.id)).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 2,
    });

    const own = await examBlueprintFixture({ ownerId: user.id, visibility: "private" });
    await prisma.goal.update({ data: { examBlueprintId: own.id }, where: { id: goal.id } });
    await unlinkGoalFromSharedExam(goal.id);

    await expect(stamp(user.id, plan.id)).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 2,
    });

    await expect(
      linkGoalToExamBlueprint({ examBlueprintId: blueprint.id, goalId: randomUUID() }),
    ).resolves.toBe(false);
  });

  it("marks cited notice formats once, preserving answers without changing plan inputs or versions", async () => {
    const { goal, plan, user } = await setup();
    const before = await stamp(user.id, plan.id);

    const request: Parameters<typeof recordGoalNoticeFormats>[0] = {
      documents: [{ sourceId: "notice", text: "The exam has five options per question." }],
      formats: [
        {
          count: null,
          countPassage: null,
          description: "Five choices",
          document: 1,
          entry: null,
          kind: "multipleChoice",
          markingPassage: null,
          options: 5,
          partialCredit: null,
          passage: "five options per question",
          select: null,
        },
      ],
      goalId: goal.id,
    };

    await Promise.all([recordGoalNoticeFormats(request), recordGoalNoticeFormats(request)]);

    await expect(stamp(user.id, plan.id)).resolves.toStrictEqual({ ...before });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      version: plan.version,
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      details: { kept: "answer", noticeFormats: expect.any(Array) },
    });

    await recordGoalNoticeFormats(request);

    await expect(stamp(user.id, plan.id)).resolves.toStrictEqual({ ...before });

    await recordGoalNoticeFormats({ ...request, formats: [] });

    await expect(stamp(user.id, plan.id)).resolves.toStrictEqual({ ...before });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      version: plan.version,
    });
  });

  it("marks notice wait transitions and deadlines, rolling back duplicate and expired claims", async () => {
    const { goal, plan, user } = await setup();
    const before = await stamp(user.id, plan.id);
    const now = new Date("2026-10-01T12:00:00Z");

    await Promise.all([
      startNoticeWait({ goalId: goal.id, now }),
      startNoticeWait({ goalId: goal.id, now }),
    ]);

    await expect(stamp(user.id, plan.id)).resolves.toStrictEqual({ ...before });

    const landing = { goalId: goal.id, now: new Date(now.getTime() + 120_000) };
    await expect(claimNoticeLanding(landing)).resolves.toBe(true);
    await expect(claimNoticeLanding(landing)).resolves.toBe(true);

    await expect(stamp(user.id, plan.id)).resolves.toStrictEqual({ ...before });

    await expect(
      claimNoticeLanding({ goalId: goal.id, now: new Date(now.getTime() + 600_000) }),
    ).resolves.toBe(false);

    await expect(stamp(user.id, plan.id)).resolves.toStrictEqual({ ...before });

    await Promise.all([endNoticeWait(goal.id), endNoticeWait(goal.id)]);

    await expect(stamp(user.id, plan.id)).resolves.toStrictEqual({ ...before });
  });

  it("marks today's kept-session stamp once while queue attempts mark freshness", async () => {
    const { goal, plan, user } = await setup();
    const context = await loadPlanContext({ goal, timeZone: "UTC" });

    if (!context) {
      throw new Error("The goal has a plan context");
    }

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: context.today,
      plannedMinutes: 0,
      status: "completed",
      userId: user.id,
    });

    const queue = await prisma.studySession.findUniqueOrThrow({
      include: { blocks: true },
      where: { id: session.id },
    });

    const change = await planChangeFixture({
      payload: { operations: [], source: "learner" },
      planId: plan.id,
      status: "applied",
    });

    const before = await stamp(user.id, plan.id);
    await followPlanToday({ changeId: change.id, context });

    await expect(
      prisma.studySession.findUniqueOrThrow({
        include: { blocks: true },
        where: { id: session.id },
      }),
    ).resolves.toStrictEqual(queue);

    await expect(stamp(user.id, plan.id)).resolves.toStrictEqual({ ...before });

    await followPlanToday({ changeId: change.id, context });

    await expect(
      prisma.studySession.findUniqueOrThrow({
        include: { blocks: true },
        where: { id: session.id },
      }),
    ).resolves.toStrictEqual(queue);

    await expect(stamp(user.id, plan.id)).resolves.toStrictEqual({ ...before });

    await expect(
      prisma.planChange.findUniqueOrThrow({ where: { id: change.id } }),
    ).resolves.toMatchObject({ payload: { source: "learner", todaySession: "unchanged" } });
  });

  it("locks plans before the learner when clearing a run failure, without invalidating plan inputs", async () => {
    const { goal, plan, user } = await setup();
    const ready = Promise.withResolvers<number>();
    const release = Promise.withResolvers<null>();

    const holder = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL lock_timeout = '1s'`;
      await tx.$queryRaw`SELECT id FROM goals WHERE id = ${goal.id}::uuid FOR UPDATE`;
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      ready.resolve(backend?.pid ?? 0);
      await release.promise;
    });

    const held = Promise.allSettled([holder]);
    void holder.catch(ready.reject);

    try {
      const holderPid = await ready.promise;

      const writing = Promise.allSettled([
        recordGoalGeneration({ generationId: randomUUID(), goalId: goal.id }),
      ]);

      try {
        await vi.waitFor(async () => {
          const [waiting] = await prisma.$queryRaw<{ blocked: boolean }[]>`
            SELECT EXISTS (
              SELECT 1 FROM pg_stat_activity
              WHERE datname = current_database() AND ${holderPid} = ANY(pg_blocking_pids(pid))
            ) AS blocked
          `;

          expect(waiting?.blocked).toBe(true);
        });

        const probe = await safeAsync(() =>
          prisma.$transaction(
            (tx) => tx.$queryRaw`
          SELECT id FROM plans WHERE id = ${plan.id}::uuid FOR UPDATE NOWAIT
        `,
          ),
        );

        expect(probe.error).toMatchObject({
          code: "P2010",
          meta: { driverAdapterError: { cause: { code: "55P03" } } },
        });
      } finally {
        release.resolve(null);
        await writing;
      }

      await expect(writing).resolves.toMatchObject([{ status: "fulfilled" }]);
    } finally {
      release.resolve(null);
      await held;
    }

    await expect(held).resolves.toMatchObject([{ status: "fulfilled" }]);

    await expect(stamp(user.id, plan.id)).resolves.toStrictEqual({
      inputVersion: plan.inputVersion,
    });
  });
});
