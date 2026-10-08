import { prisma } from "@zoonk/db";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { moveWeeklyChallenge, undoWeeklyChallengeMove } from "./move-weekly-challenge";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

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

  return { block, challenge, plan, user };
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

  it("never moves the challenge onto or past the goal's date", async () => {
    const { block, plan } = await setup();

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
  });

  it("moves only a pending weekly challenge of the learner's own", async () => {
    const [{ block, user }, other] = await Promise.all([setup(), userFixture()]);

    mockSession(other.id);

    await expect(moveWeeklyChallenge({ blockId: block.id, input: {} })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(user.id);
    await prisma.studySessionBlock.update({ data: { status: "active" }, where: { id: block.id } });

    await expect(moveWeeklyChallenge({ blockId: block.id, input: {} })).resolves.toStrictEqual({
      status: "notMovable",
    });
  });
});
