import { prisma } from "@zoonk/db";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../_test-utils/learner-lock";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { applyChallengeMove, restoreChallengeBlock } from "./_utils/challenge-move";
import { moveChallenge, undoChallengeMove } from "./move-challenge";
import { moveWeeklyChallenge, undoWeeklyChallengeMove } from "./move-weekly-challenge";

/** A Monday in 2020, before other tests' learning events, so the planner's pace is its own. */
const MONDAY = new Date("2020-09-28T12:00:00Z");

/** The plan's first weekly challenge falls on this Sunday, the day the learner opens it. */
const CHALLENGE_DAY = new Date("2020-10-11T12:00:00Z");
const LESSONS_PER_SKILL = 30;

/** A planned goal long enough for a weekly checkpoint, with today's session holding it. */
async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [{ lessons: LESSONS_PER_SKILL }, { lessons: LESSONS_PER_SKILL }],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const challenge = await prisma.planItem.findFirstOrThrow({
    orderBy: [{ scheduledFor: "asc" }, { position: "asc" }, { id: "asc" }],
    where: { kind: "checkpoint", planId: plan.id },
  });

  vi.setSystemTime(CHALLENGE_DAY);

  const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

  const block = await studySessionBlockFixture({
    kind: "checkpoint",
    payload: {
      checkpoint: {
        kind: "weekly",
        mock: false,
        passMark: 5,
        phase: 0,
        rematch: false,
        timeLimitMinutes: null,
      },
      itemIds: [],
      planItemId: challenge.id,
    },
    position: 0,
    sessionId: session.id,
  });

  mockSession(user.id);

  return { block, challenge, plan, session, user };
}

/** The saved plan, including the identities today's block payloads refer to. */
async function readPlan(planId: string) {
  const { coveredShare, estimateHours, graph, inputsKey, items, phases, settings } =
    await prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { id: planId },
    });

  return {
    coveredShare,
    estimateHours,
    graph,
    inputsKey,
    items: items.map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...item }) => item),
    phases,
    settings,
  };
}

/** Today's exact work and progress, without persistence timestamps or the plan's version. */
async function readToday(sessionId: string) {
  const { blocks, id, localDate, plannedMinutes, status } =
    await prisma.studySession.findUniqueOrThrow({
      include: { blocks: { orderBy: { position: "asc" } } },
      where: { id: sessionId },
    });

  return {
    blocks: blocks.map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...block }) => block),
    id,
    localDate,
    plannedMinutes,
    status,
  };
}

async function challengeDates(planId: string) {
  const items = await prisma.planItem.findMany({
    orderBy: { scheduledFor: "asc" },
    where: { kind: "checkpoint", planId, status: "todo" },
  });

  return items.map((item) => item.scheduledFor?.toISOString().slice(0, 10));
}

async function statusOf(blockId: string) {
  const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
  return block.status;
}

describe(moveWeeklyChallenge, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refuses a stale session move onto a closed Monday without skipping its block", async () => {
    const { block, plan, session } = await setup();

    await prisma.plan.update({
      data: { settings: { startDate: "2020-09-28", weekdayMinutes: [12, 0, 12, 12, 12, 12, 12] } },
      where: { id: plan.id },
    });

    const [beforePlan, beforeToday] = await Promise.all([readPlan(plan.id), readToday(session.id)]);

    await expect(
      moveWeeklyChallenge({ blockId: block.id, input: { timeZone: "UTC" } }),
    ).resolves.toStrictEqual({ error: "badMove", status: "invalid" });

    await expect(readPlan(plan.id)).resolves.toStrictEqual(beforePlan);
    await expect(readToday(session.id)).resolves.toStrictEqual(beforeToday);
  });

  it("moves the week's challenge to Monday through the plan, and undo brings it back", async () => {
    const { block, challenge, plan } = await setup();

    expect(challenge.scheduledFor?.toISOString().slice(0, 10)).toBe("2020-10-11");

    const moved = await moveWeeklyChallenge({ blockId: block.id, input: { timeZone: "UTC" } });

    expect(moved).toMatchObject({ move: { date: "2020-10-12" }, status: "moved" });
    await expect(challengeDates(plan.id)).resolves.toContain("2020-10-12");
    await expect(challengeDates(plan.id)).resolves.not.toContain("2020-10-11");
    await expect(statusOf(block.id)).resolves.toBe("skipped");

    const changeId = moved.status === "moved" ? (moved.move.changeId ?? "") : "";

    await expect(
      undoWeeklyChallengeMove({ blockId: block.id, changeId, input: { timeZone: "UTC" } }),
    ).resolves.toStrictEqual({ status: "undone" });

    await expect(challengeDates(plan.id)).resolves.toContain("2020-10-11");
    await expect(statusOf(block.id)).resolves.toBe("pending");

    const [restored, back] = await Promise.all([
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
      prisma.planItem.findFirstOrThrow({
        where: { kind: "checkpoint", planId: plan.id, scheduledFor: new Date("2020-10-11") },
      }),
    ]);

    expect(restored.payload).toMatchObject({ planItemId: back.id });
  });

  it.each(["session", "challenge"] as const)(
    "undo from the %s gives back the exact plan and today's session together",
    async (entry) => {
      const { block, challenge, plan, session } = await setup();

      const lesson = await prisma.planItem.findFirstOrThrow({
        where: { kind: "lesson", lessonId: { not: null }, planId: plan.id },
      });

      await Promise.all([
        studySessionBlockFixture({
          completedAt: CHALLENGE_DAY,
          estimatedMinutes: 4,
          lessonId: lesson.lessonId,
          payload: { planItemId: lesson.id, title: "The lesson already finished" },
          position: 1,
          sessionId: session.id,
          startedAt: CHALLENGE_DAY,
          status: "completed",
        }),
        studySessionBlockFixture({
          estimatedMinutes: 6,
          kind: "practice",
          payload: { itemIds: [], title: "Practice today's mistakes" },
          position: 2,
          sessionId: session.id,
        }),
        prisma.studySession.update({ data: { status: "active" }, where: { id: session.id } }),
      ]);

      const [beforePlan, beforeToday] = await Promise.all([
        readPlan(plan.id),
        readToday(session.id),
      ]);

      const moved =
        entry === "session"
          ? await moveWeeklyChallenge({ blockId: block.id, input: { timeZone: "UTC" } })
          : await moveChallenge({ input: { timeZone: "UTC" }, planItemId: challenge.id });

      expect(moved).toMatchObject({ move: { date: "2020-10-12" }, status: "moved" });

      if (moved.status !== "moved" || !moved.move.changeId) {
        throw new Error("Expected the moved challenge and its Undo");
      }

      await expect(statusOf(block.id)).resolves.toBe("skipped");

      const destination = await prisma.planItem.findFirstOrThrow({
        where: { kind: "checkpoint", planId: plan.id, scheduledFor: new Date("2020-10-12") },
      });

      const undone =
        entry === "session"
          ? await undoWeeklyChallengeMove({
              blockId: block.id,
              changeId: moved.move.changeId,
              input: { timeZone: "UTC" },
            })
          : await undoChallengeMove({
              changeId: moved.move.changeId,
              input: { timeZone: "UTC" },
              planItemId: destination.id,
            });

      expect(undone.status).toBe("undone");
      await expect(readPlan(plan.id)).resolves.toStrictEqual(beforePlan);
      await expect(readToday(session.id)).resolves.toStrictEqual(beforeToday);

      await expect(
        prisma.planItem.findUniqueOrThrow({ where: { id: challenge.id } }),
      ).resolves.toMatchObject({ scheduledFor: new Date("2020-10-11"), status: "todo" });
    },
  );

  it("moves only a pending weekly challenge of the learner's own, never onto or past the goal's date", async () => {
    const [{ block, plan, user }, other] = await Promise.all([setup(), userFixture()]);

    mockSession(other.id);

    await expect(moveWeeklyChallenge({ blockId: block.id, input: {} })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(user.id);

    // A test on the Monday the challenge would move to: moving the mock there no longer prepares.
    await prisma.goal.update({
      data: { targetDate: new Date("2020-10-12") },
      where: { id: plan.goalId },
    });

    await expect(
      moveWeeklyChallenge({ blockId: block.id, input: { timeZone: "UTC" } }),
    ).resolves.toStrictEqual({ status: "notMovable" });

    await expect(challengeDates(plan.id)).resolves.toContain("2020-10-11");
    await expect(statusOf(block.id)).resolves.toBe("pending");

    // Without the date, a started challenge stays where it is.
    await Promise.all([
      prisma.goal.update({ data: { targetDate: null }, where: { id: plan.goalId } }),
      prisma.studySessionBlock.update({ data: { status: "active" }, where: { id: block.id } }),
    ]);

    await expect(moveWeeklyChallenge({ blockId: block.id, input: {} })).resolves.toStrictEqual({
      status: "notMovable",
    });
  });
});

describe("challenge block learner locks", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["pending", "completed"] as const)(
    "marks the move and only a changed %s block",
    async (status) => {
      const { block, challenge, plan, user } = await setup();
      await prisma.studySessionBlock.update({ data: { status }, where: { id: block.id } });

      const result = await applyChallengeMove({
        block,
        from: challenge.scheduledFor!,
        goalId: plan.goalId,
        input: { timeZone: "UTC" },
        planId: plan.id,
        userId: user.id,
      });

      expect(result.status).toBe("moved");

      await expect(statusOf(block.id)).resolves.toBe(
        status === "pending" ? "skipped" : "completed",
      );
    },
  );

  it("marks a restored block once and leaves a repeated restore unchanged", async () => {
    const user = await userFixture();
    const session = await studySessionFixture({ userId: user.id });
    const block = await studySessionBlockFixture({ sessionId: session.id, status: "skipped" });
    const challenge = { id: crypto.randomUUID() };
    await restoreChallengeBlock({ block, challenge, userId: user.id });
    await restoreChallengeBlock({ block, challenge, userId: user.id });
    await expect(statusOf(block.id)).resolves.toBe("pending");
  });

  it("serializes competing restores at the learner marker before locking the block", async () => {
    const user = await userFixture();
    const session = await studySessionFixture({ userId: user.id });
    const block = await studySessionBlockFixture({ sessionId: session.id, status: "skipped" });
    const challenge = { id: crypto.randomUUID() };

    const holder = holdLearnerLock({
      beforeCommit: async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM study_session_blocks WHERE id = ${block.id}::uuid FOR UPDATE`;
      },
      userId: user.id,
    });

    const pid = await holder.pid;

    const contenders = Promise.all([
      restoreChallengeBlock({ block, challenge, userId: user.id }),
      restoreChallengeBlock({ block, challenge, userId: user.id }),
    ]);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
    } finally {
      holder.release();
      await Promise.all([holder.done, contenders]);
    }

    await expect(contenders).resolves.toHaveLength(2);
  });
});
