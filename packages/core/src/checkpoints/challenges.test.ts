import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { answerBlockInOrder } from "../sessions/_test-utils/answer-block";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../sessions/_test-utils/session-goal";
import { BRAIN_POWER_BONUS } from "../sessions/brain-power";
import { finishStudyBlock } from "../sessions/finish-study-block";
import { getChallenge } from "./get-challenge";
import { getCheckpoint } from "./get-checkpoint";
import { moveChallenge, undoChallengeMove } from "./move-challenge";
import { startChallenge } from "./start-challenge";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({ classifyMistakeCause: vi.fn() }));

/** A goal whose first phase (two lessons) is done, so its boss is reached today. */
async function bossSetup() {
  const user = await userFixture();
  const fixture = await sessionGoalFixture({ lessons: 3, userId: user.id });
  const [first, second, third] = fixture.planItems;

  await prisma.planItem.update({ data: { phase: 1, position: 5 }, where: { id: third?.id } });

  await prisma.planItem.updateMany({
    data: { status: "done" },
    where: { id: { in: [first?.id ?? "", second?.id ?? ""] } },
  });

  const boss = await checkpointItemFixture({ kind: "boss", planId: fixture.plan.id, position: 2 });
  mockSession(user.id);

  return { ...fixture, boss, user };
}

async function challengeOf(planItemId: string) {
  const result = await getChallenge({ input: {}, planItemId });

  if (result.status !== "ready") {
    throw new Error(`Expected the challenge, got ${result.status}`);
  }

  return result.challenge;
}

/** Starts the boss from its intro and plays it, every answer the same option. */
async function playBoss({ optionIndex, planItemId }: { optionIndex: number; planItemId: string }) {
  const started = await startChallenge({ input: {}, planItemId });

  if (started.status !== "ready") {
    throw new Error(`Expected the boss to start, got ${started.status}`);
  }

  const { blockId, sessionId } = started.destination;
  await answerBlockInOrder({ blockId, optionIndex, sessionId });
  await finishStudyBlock({ blockId, input: {}, sessionId });

  return started.destination;
}

describe("a phase checkpoint's challenge", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says what it asks on its day, and starting it opens its block in today's session", async () => {
    const { boss, goal } = await bossSetup();
    const intro = await challengeOf(boss.id);

    expect(intro).toMatchObject({
      canMove: false,
      goalId: goal.id,
      kind: "boss",
      passMark: 5,
      phase: { index: 0, name: "Basics" },
      questions: 6,
      rematch: false,
      reward: { badge: true, brainPower: BRAIN_POWER_BONUS.phaseBoss },
      status: "ready",
      today: "2026-09-30",
    });

    const started = await startChallenge({ input: {}, planItemId: boss.id });

    expect(started).toMatchObject({
      destination: { blockId: intro.blockId, kind: "checkpoint" },
      status: "ready",
    });

    await expect(challengeOf(boss.id)).resolves.toMatchObject({ status: "started" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: intro.blockId ?? "" } }),
    ).resolves.toMatchObject({ status: "active" });
  });

  it("not passed, it tries again tomorrow, then is back in the plan, as the result says", async () => {
    const { boss } = await bossSetup();
    const lost = await playBoss({ optionIndex: 1, planItemId: boss.id });

    await expect(challengeOf(boss.id)).resolves.toMatchObject({
      blockId: lost.blockId,
      rematch: false,
      status: "tried",
    });

    await expect(getCheckpoint(lost.blockId)).resolves.toMatchObject({
      checkpoint: { result: { passed: false }, retry: "tomorrow" },
    });

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + DAY_MS));

    await expect(challengeOf(boss.id)).resolves.toMatchObject({ rematch: true, status: "ready" });

    // Reopened a day later, the old result no longer promises "tomorrow".
    await expect(getCheckpoint(lost.blockId)).resolves.toMatchObject({
      checkpoint: { retry: "open" },
    });

    const won = await playBoss({ optionIndex: 0, planItemId: boss.id });

    await expect(challengeOf(boss.id)).resolves.toMatchObject({
      blockId: won.blockId,
      status: "done",
    });

    await expect(getCheckpoint(lost.blockId)).resolves.toMatchObject({
      checkpoint: { retry: "passed" },
    });
  });

  it("is only the learner's own", async () => {
    const [{ boss }, other] = await Promise.all([bossSetup(), userFixture()]);
    mockSession(other.id);

    await expect(getChallenge({ input: {}, planItemId: boss.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(startChallenge({ input: {}, planItemId: boss.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });
});

/** A Monday in 2020, before other tests' learning events, so the planner's pace is its own. */
const MONDAY = new Date("2020-10-05T12:00:00Z");

/** A planned goal long enough for weekly challenges; the first one this week is on Sunday. */
async function weeklySetup() {
  const user = await userFixture();
  const library = await planLibraryFixture({ skills: [{ lessons: 30 }, { lessons: 30 }] });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const challenge = await prisma.planItem.findFirstOrThrow({
    where: { kind: "checkpoint", planId: plan.id, scheduledFor: new Date("2020-10-11") },
  });

  mockSession(user.id);

  return { challenge, goal, plan };
}

describe("the week's challenge before its day", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says when it is, and moves to Monday from there, with an undo", async () => {
    const { challenge, plan } = await weeklySetup();

    await expect(challengeOf(challenge.id)).resolves.toMatchObject({
      blockId: null,
      canMove: true,
      date: "2020-10-11",
      kind: "weekly",
      passMark: null,
      status: "upcoming",
      today: "2020-10-05",
    });

    const moved = await moveChallenge({ input: {}, planItemId: challenge.id });

    if (moved.status !== "moved" || !moved.move.planItemId || !moved.move.changeId) {
      throw new Error(`Expected the challenge to move, got ${moved.status}`);
    }

    expect(moved.move.date).toBe("2020-10-12");

    // A dated item is a new one on its new day: the old one is gone, the new one says Monday.
    await expect(getChallenge({ input: {}, planItemId: challenge.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    // Moved once, it stays: the undo is how it goes back.
    await expect(challengeOf(moved.move.planItemId)).resolves.toMatchObject({
      canMove: false,
      date: "2020-10-12",
      status: "upcoming",
    });

    const undone = await undoChallengeMove({
      changeId: moved.move.changeId,
      input: {},
      planItemId: moved.move.planItemId,
    });

    if (undone.status !== "undone" || !undone.planItemId) {
      throw new Error(`Expected the move undone, got ${undone.status}`);
    }

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: undone.planItemId } }),
    ).resolves.toMatchObject({ planId: plan.id, scheduledFor: new Date("2020-10-11") });
  });

  it("has no time of its own outside an exam, unless the learner said when they study", async () => {
    const { challenge, goal } = await weeklySetup();

    await expect(challengeOf(challenge.id)).resolves.toMatchObject({
      mock: false,
      startTime: null,
      timeZone: null,
    });

    await prisma.goal.update({ data: { studyTime: "19:00" }, where: { id: goal.id } });

    await expect(challengeOf(challenge.id)).resolves.toMatchObject({
      startTime: "19:00",
      timeZone: null,
    });
  });

  it("never moves from a day that's past", async () => {
    const { challenge } = await weeklySetup();

    vi.setSystemTime(new Date("2020-10-12T12:00:00Z"));

    await expect(moveChallenge({ input: {}, planItemId: challenge.id })).resolves.toStrictEqual({
      status: "notMovable",
    });
  });
});

const EXAM_STRUCTURE = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "Right answers", method: "raw" },
    sections: [{ day: null, minutes: 30, name: "Math", questions: 18 }],
    timeLimitMinutes: 30,
    totalQuestions: 18,
  },
  rules: [],
  subjects: [],
};

const EDITION = {
  citations: [],
  dates: [
    {
      citation: { passage: "The exam starts at 1:30 PM.", sourceId: "notice" },
      date: "2026-11-08",
      kind: "exam",
      label: "Exam day",
      startTime: "13:30",
    },
  ],
  noticeUrl: null,
  questionCount: null,
  sourceHash: null,
  timeZone: "America/Sao_Paulo",
  year: 2026,
};

describe("the week's mock before its day", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rehearses the real exam's start time, whatever time the learner usually studies", async () => {
    const user = await userFixture();
    const blueprint = await examBlueprintFixture({ edition: EDITION, structure: EXAM_STRUCTURE });

    const { plan } = await sessionGoalFixture({
      goal: { examBlueprintId: blueprint.id, kind: "exam", studyTime: "07:00" },
      userId: user.id,
    });

    const [mock] = await Promise.all([
      checkpointItemFixture({
        kind: "mock",
        planId: plan.id,
        position: 10,
        scheduledFor: new Date(SESSION_TODAY.getTime() + 4 * DAY_MS),
      }),
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      }),
    ]);

    mockSession(user.id);

    await expect(challengeOf(mock.id)).resolves.toMatchObject({
      date: "2026-10-04",
      examName: "Test Exam",
      // Weeks before the exam's final stretch, it's the short version.
      fullLength: false,
      mock: true,
      number: 1,
      startTime: "13:30",
      status: "upcoming",
      timeZone: "America/Sao_Paulo",
    });
  });

  it("offers Plus already, without a day to move to, when the plan doesn't include mocks", async () => {
    const user = await userFixture();
    const blueprint = await examBlueprintFixture({ edition: EDITION, structure: EXAM_STRUCTURE });

    const { plan } = await sessionGoalFixture({
      goal: { examBlueprintId: blueprint.id, kind: "exam" },
      userId: user.id,
    });

    const mock = await checkpointItemFixture({
      kind: "mock",
      planId: plan.id,
      position: 10,
      scheduledFor: new Date(SESSION_TODAY.getTime() + 4 * DAY_MS),
    });

    mockSession(user.id);

    await expect(challengeOf(mock.id)).resolves.toMatchObject({
      canMove: false,
      mock: true,
      status: "plusRequired",
    });
  });
});
