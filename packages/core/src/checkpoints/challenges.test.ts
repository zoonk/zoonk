import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, layOutPlanFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { type SavedItemFacts } from "../plans/_utils/selected-item-contract";
import { createGoalPlan } from "../plans/create-goal-plan";
import { answerBlockInOrder } from "../sessions/_test-utils/answer-block";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../sessions/_test-utils/session-goal";
import { getBlockItemIds, readBlockPayload } from "../sessions/block-payload";
import { BRAIN_POWER_BONUS } from "../sessions/brain-power";
import { finishStudyBlock } from "../sessions/finish-study-block";
import { startStudyBlock } from "../sessions/start-study-block";
import { requestChallengeQuestions } from "./challenge-questions";
import { getCheckpointMinutes } from "./checkpoint-minutes";
import { MIN_CHECKPOINT_QUESTIONS } from "./checkpoint-rules";
import { getChallenge } from "./get-challenge";
import { getCheckpoint } from "./get-checkpoint";
import { moveChallenge, undoChallengeMove } from "./move-challenge";
import { startChallenge } from "./start-challenge";

function byId(a: string, b: string): number {
  return a.localeCompare(b);
}

async function bossSetup({ itemsPerSkill }: { itemsPerSkill?: number } = {}) {
  const user = await userFixture();
  const fixture = await sessionGoalFixture({ itemsPerSkill, lessons: 3, userId: user.id });
  const [first, second, third] = fixture.planItems;

  await prisma.planItem.update({ data: { phase: 1, position: 5 }, where: { id: third?.id } });

  await prisma.planItem.updateMany({
    data: { status: "done" },
    where: { id: { in: [first?.id ?? "", second?.id ?? ""] } },
  });

  const boss = await checkpointItemFixture({ kind: "boss", planId: fixture.plan.id, position: 2 });
  const minutes = getCheckpointMinutes(10);
  const skillIds = fixture.skills.slice(0, 2).map((skill) => skill.id);

  const facts: SavedItemFacts = {
    boss: {
      kind: "text",
      minutes,
      questions: 10,
      testedKeys: [],
      testedSkillIds: skillIds,
      waiting: false,
    },
    minutes,
    parts: { checkpoint: minutes, practice: 0, unwritten: 0, written: 0 },
    schemaVersion: 1,
    skillIds,
  };

  await Promise.all([
    prisma.planItem.update({ data: { facts }, where: { id: boss.id } }),
    layOutPlanFixture(fixture.plan.id),
  ]);

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
      blockId: null,
      canMove: false,
      goalId: goal.id,
      kind: "boss",
      passMark: 7,
      phase: { index: 0, name: "Basics" },
      questions: 10,
      rematch: false,
      reward: { badge: true, brainPower: BRAIN_POWER_BONUS.phaseBoss },
      status: "ready",
      today: "2026-09-30",
    });

    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);

    const started = await startChallenge({ input: {}, planItemId: boss.id });

    if (started.status !== "ready") {
      throw new Error(`Expected Start to persist the challenge, got ${started.status}`);
    }

    expect(started).toMatchObject({
      destination: { blockId: expect.any(String), kind: "checkpoint" },
      status: "ready",
    });

    await expect(challengeOf(boss.id)).resolves.toMatchObject({
      blockId: started.destination.blockId,
      status: "started",
    });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: started.destination.blockId } }),
    ).resolves.toMatchObject({ status: "active" });
  });

  it("past today's study time, says so before Start, as Start refuses; a started one goes on", async () => {
    const { boss, goal, user } = await bossSetup();

    await expect(getTodayStudySession({ goalId: goal.id })).resolves.toMatchObject({
      status: "ready",
    });

    const unlimited = await countDatabaseStatements(() => challengeOf(boss.id));
    expect(unlimited.result).toMatchObject({ dailyLimitReached: false, status: "ready" });

    const limit = (dailyLimitMinutes: number | null) =>
      prisma.userLearningProfile.upsert({
        create: { dailyLimitMinutes, userId: user.id },
        update: { dailyLimitMinutes },
        where: { userId: user.id },
      });

    await Promise.all([
      limit(30),
      dailyProgressFixtureMany([
        { date: SESSION_TODAY, timeSpentSeconds: 30 * 60, userId: user.id },
      ]),
    ]);

    const limited = await countDatabaseStatements(() => challengeOf(boss.id));

    expect(limited.writes).toBe(0);
    expect(limited.statements).toBe(unlimited.statements + 1);

    expect(limited.result).toMatchObject({
      dailyLimitReached: true,
      nextStudyDate: "2026-10-01",
      status: "ready",
    });

    expect(unlimited.result).toMatchObject({ nextStudyDate: null });

    await expect(startChallenge({ input: {}, planItemId: boss.id })).resolves.toStrictEqual({
      status: "dailyLimitReached",
    });

    await limit(null);

    await expect(startChallenge({ input: {}, planItemId: boss.id })).resolves.toMatchObject({
      status: "ready",
    });

    await limit(30);

    await expect(challengeOf(boss.id)).resolves.toMatchObject({
      dailyLimitReached: false,
      status: "started",
    });
  });

  it("past today's study time in an exam's plan, names no day, as its runs pick the challenge's day", async () => {
    const { boss, goal, user } = await bossSetup();

    await expect(getTodayStudySession({ goalId: goal.id })).resolves.toMatchObject({
      status: "ready",
    });

    await Promise.all([
      prisma.goal.update({
        data: { kind: "exam", targetDate: new Date("2026-12-15T00:00:00Z") },
        where: { id: goal.id },
      }),
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      }),
      prisma.userLearningProfile.upsert({
        create: { dailyLimitMinutes: 30, userId: user.id },
        update: { dailyLimitMinutes: 30 },
        where: { userId: user.id },
      }),
      dailyProgressFixtureMany([
        { date: SESSION_TODAY, timeSpentSeconds: 30 * 60, userId: user.id },
      ]),
    ]);

    await expect(challengeOf(boss.id)).resolves.toMatchObject({
      dailyLimitReached: true,
      nextStudyDate: null,
      status: "ready",
    });
  });

  it("counts today's study time on the learner's day, as Start does, when its goal is on another date", async () => {
    const { boss, goal, user } = await bossSetup();

    await expect(getTodayStudySession({ goalId: goal.id })).resolves.toMatchObject({
      status: "ready",
    });

    const active = await goalFixture({ timezone: "Pacific/Kiritimati", userId: user.id });
    const learnerDay = new Date(SESSION_TODAY.getTime() + DAY_MS);

    await prisma.userLearningProfile.upsert({
      create: { activeGoalId: active.id, dailyLimitMinutes: 30, userId: user.id },
      update: { activeGoalId: active.id, dailyLimitMinutes: 30 },
      where: { userId: user.id },
    });

    const useUpOn = async (date: Date) => {
      await prisma.dailyProgress.deleteMany({ where: { userId: user.id } });
      await dailyProgressFixtureMany([{ date, timeSpentSeconds: 30 * 60, userId: user.id }]);
    };

    await useUpOn(learnerDay);

    await expect(challengeOf(boss.id)).resolves.toMatchObject({
      dailyLimitReached: true,
      status: "ready",
    });

    await expect(startChallenge({ input: {}, planItemId: boss.id })).resolves.toStrictEqual({
      status: "dailyLimitReached",
    });

    await useUpOn(SESSION_TODAY);

    await expect(challengeOf(boss.id)).resolves.toMatchObject({
      dailyLimitReached: false,
      status: "ready",
    });

    await expect(startChallenge({ input: {}, planItemId: boss.id })).resolves.toMatchObject({
      status: "ready",
    });
  });

  it("with too few questions, Start asks for them to be written, then starts with the ones written since", async () => {
    const { boss, skills } = await bossSetup({ itemsPerSkill: 1 });

    await expect(challengeOf(boss.id)).resolves.toMatchObject({
      passMark: 7,
      questions: 10,
      status: "ready",
    });

    await expect(startChallenge({ input: {}, planItemId: boss.id })).resolves.toStrictEqual({
      status: "questionsNeeded",
    });

    await Promise.all(
      Array.from({ length: 4 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: skills[0]?.id ?? "" }),
      ),
    );

    await expect(startChallenge({ input: {}, planItemId: boss.id })).resolves.toStrictEqual({
      status: "questionsNeeded",
    });

    const started = await startChallenge({ input: { afterWriting: true }, planItemId: boss.id });

    if (started.status !== "ready") {
      throw new Error(`Expected the challenge to start, got ${started.status}`);
    }

    const block = await prisma.studySessionBlock.findUniqueOrThrow({
      where: { id: started.destination.blockId },
    });

    expect(block).toMatchObject({ estimatedMinutes: 9, status: "active" });
    expect(getBlockItemIds(readBlockPayload(block))).toHaveLength(6);
    expect(readBlockPayload(block).checkpoint).toMatchObject({ passMark: 5 });
  });

  it("not passed, it tries again tomorrow, then is back in the plan, as the result says", async () => {
    const { boss, goal, user } = await bossSetup();
    const lost = await playBoss({ optionIndex: 1, planItemId: boss.id });

    await expect(challengeOf(boss.id)).resolves.toMatchObject({
      blockId: lost.blockId,
      rematch: false,
      result: { correct: 0, passed: false, total: 6 },
      status: "tried",
    });

    await expect(getCheckpoint(lost.blockId)).resolves.toMatchObject({
      checkpoint: { result: { passed: false }, retry: "tomorrow" },
    });

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + DAY_MS));

    await expect(challengeOf(boss.id)).resolves.toMatchObject({ rematch: true, status: "ready" });

    await expect(getCheckpoint(lost.blockId)).resolves.toMatchObject({
      checkpoint: { retry: "open" },
    });

    await expect(startChallenge({ input: {}, planItemId: boss.id })).resolves.toStrictEqual({
      reason: "lessons",
      status: "earlierFirst",
    });

    const today = await getTodayStudySession({ goalId: goal.id });

    if (today.status !== "ready") {
      throw new Error("Expected the rematch's session");
    }

    const lessons = today.session.blocks.filter((block) => block.kind === "learn");

    expect(lessons.filter((block) => block.reinforcement)).toHaveLength(2);

    await lessons.reduce(async (previous, block) => {
      await previous;
      await startStudyBlock({ blockId: block.id, input: {}, sessionId: today.session.id });

      await learningEventFixture({
        contentIds: { lessonId: block.lessonId, studySessionId: today.session.id },
        userId: user.id,
      });

      await expect(
        finishStudyBlock({ blockId: block.id, input: {}, sessionId: today.session.id }),
      ).resolves.toMatchObject({ status: "ready" });
    }, Promise.resolve());

    const won = await playBoss({ optionIndex: 0, planItemId: boss.id });

    await expect(challengeOf(boss.id)).resolves.toMatchObject({
      blockId: won.blockId,
      result: { correct: 6, passed: true, total: 6 },
      status: "done",
    });

    await expect(getCheckpoint(lost.blockId)).resolves.toMatchObject({
      checkpoint: { retry: "passed" },
    });
  });

  it("says what it asks about before its day, as its duel asks on the day", async () => {
    const { boss, planItems } = await bossSetup();
    const [first, second] = planItems;
    const lessonIds = [first?.id ?? "", second?.id ?? ""];

    await prisma.planItem.update({
      data: { scheduledFor: new Date(SESSION_TODAY.getTime() + DAY_MS) },
      where: { id: boss.id },
    });

    await prisma.planItem.updateMany({
      data: { status: "todo" },
      where: { id: { in: lessonIds } },
    });

    const topics = [
      { name: "Skill 1", subject: "Basics" },
      { name: "Skill 2", subject: "Basics" },
    ];

    await expect(challengeOf(boss.id)).resolves.toMatchObject({
      blockId: null,
      status: "upcoming",
      topics,
    });

    await prisma.planItem.updateMany({
      data: { status: "done" },
      where: { id: { in: lessonIds } },
    });

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + DAY_MS));

    await expect(challengeOf(boss.id)).resolves.toMatchObject({ status: "ready", topics });
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

describe("the week's mixed challenge with too few questions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps its day, and starts once the questions it lacks are written", async () => {
    const user = await userFixture();

    const { items, plan, skills } = await sessionGoalFixture({
      itemsPerSkill: 1,
      lessons: 3,
      userId: user.id,
    });

    const [weekly] = await Promise.all([
      checkpointItemFixture({
        kind: "checkpoint",
        planId: plan.id,
        position: 10,
        scheduledFor: SESSION_TODAY,
      }),
      ...items
        .slice(0, 2)
        .map((item) =>
          attemptFixture({
            answeredAt: new Date(SESSION_NOW.getTime() - 2 * DAY_MS),
            itemId: item.id,
            skillId: item.skillId,
            userId: user.id,
          }),
        ),
    ]);

    mockSession(user.id);

    await expect(challengeOf(weekly.id)).resolves.toMatchObject({
      kind: "weekly",
      questions: null,
      status: "ready",
    });

    await expect(startChallenge({ input: {}, planItemId: weekly.id })).resolves.toStrictEqual({
      status: "questionsNeeded",
    });

    const writing = await requestChallengeQuestions({ planItemId: weekly.id });

    expect(writing).toMatchObject({
      status: "start",
      writes: [{ questionsPerSkill: 4, target: 5 }],
    });

    expect(writing.status === "start" && writing.writes[0]?.skillIds.toSorted(byId)).toStrictEqual(
      [skills[0]?.id ?? "", skills[1]?.id ?? ""].toSorted(byId),
    );

    await Promise.all(
      Array.from({ length: 4 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: skills[1]?.id ?? "" }),
      ),
    );

    const started = await startChallenge({ input: { afterWriting: true }, planItemId: weekly.id });

    if (started.status !== "ready") {
      throw new Error(`Expected the challenge to start, got ${started.status}`);
    }

    const block = await prisma.studySessionBlock.findUniqueOrThrow({
      where: { id: started.destination.blockId },
    });

    expect(getBlockItemIds(readBlockPayload(block))).toHaveLength(6);
  });

  it("asks every question of the week's challenge, however many are already right", async () => {
    const user = await userFixture();
    const { items, plan, skills } = await sessionGoalFixture({ lessons: 3, userId: user.id });

    const studied = skills
      .slice(0, 2)
      .map((skill) => items.find((item) => item.skillId === skill.id));

    const [weekly] = await Promise.all([
      checkpointItemFixture({
        kind: "checkpoint",
        planId: plan.id,
        position: 10,
        scheduledFor: SESSION_TODAY,
      }),
      ...studied.map((item) =>
        attemptFixture({
          answeredAt: new Date(SESSION_NOW.getTime() - 2 * DAY_MS),
          itemId: item?.id,
          skillId: item?.skillId,
          userId: user.id,
        }),
      ),
    ]);

    mockSession(user.id);
    const started = await startChallenge({ input: {}, planItemId: weekly.id });

    if (started.status !== "ready") {
      throw new Error(`Expected the challenge to start, got ${started.status}`);
    }

    const { blockId, sessionId } = started.destination;
    const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
    const payload = readBlockPayload(block);
    const passMark = payload.checkpoint?.passMark ?? 0;

    expect(passMark).toBeLessThan(getBlockItemIds(payload).length);

    await answerBlockInOrder({ blockId, count: passMark, sessionId });

    await expect(finishStudyBlock({ blockId, input: {}, sessionId })).resolves.toStrictEqual({
      status: "unanswered",
    });
  });
});

const MONDAY = new Date("2020-10-05T12:00:00Z");

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

  return { challenge, goal, plan, skills: library.skills };
}

async function weeklyChallengeFixture() {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });

  const plan = await planFixture({
    goalId: goal.id,
    graph: { skills: [{ lessons: 1, name: "Skill", phase: 0, skillId: randomUUID() }] },
  });

  const challenge = await checkpointItemFixture({
    kind: "checkpoint",
    planId: plan.id,
    position: 0,
    scheduledFor: new Date("2020-10-11"),
  });

  mockSession(user.id);

  return { challenge, goal };
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
      topics: [],
    });

    const moved = await moveChallenge({ input: {}, planItemId: challenge.id });

    if (moved.status !== "moved" || !moved.move.planItemId || !moved.move.changeId) {
      throw new Error(`Expected the challenge to move, got ${moved.status}`);
    }

    expect(moved.move.date).toBe("2020-10-12");

    await expect(getChallenge({ input: {}, planItemId: challenge.id })).resolves.toStrictEqual({
      status: "notFound",
    });

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
    const { challenge, goal } = await weeklyChallengeFixture();

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

  it("isn't offered to move onto a Monday that has a weekly event, and the move is refused", async () => {
    const { challenge } = await weeklyChallengeFixture();

    await checkpointItemFixture({
      kind: "mock",
      planId: challenge.planId,
      position: 1,
      scheduledFor: new Date("2020-10-12"),
    });

    await expect(challengeOf(challenge.id)).resolves.toMatchObject({ canMove: false });

    await expect(moveChallenge({ input: {}, planItemId: challenge.id })).resolves.toStrictEqual({
      error: "mockCollision",
      status: "invalid",
    });
  });

  it("never moves from a day that's past", async () => {
    const { challenge } = await weeklyChallengeFixture();

    await expect(challengeOf(challenge.id)).resolves.toMatchObject({ canMove: true });

    vi.setSystemTime(new Date("2020-10-12T12:00:00Z"));

    await expect(moveChallenge({ input: {}, planItemId: challenge.id })).resolves.toStrictEqual({
      status: "notMovable",
    });
  });
});

async function useUpStudyTime({ date, userId }: { date: Date; userId: string }) {
  await Promise.all([
    prisma.userLearningProfile.upsert({
      create: { dailyLimitMinutes: 30, userId },
      update: { dailyLimitMinutes: 30 },
      where: { userId },
    }),
    dailyProgressFixtureMany([{ date, timeSpentSeconds: 30 * 60, userId }]),
  ]);
}

const SUNDAY = new Date("2020-10-11T00:00:00Z");

async function studyTheWeek({ skillId, userId }: { skillId: string; userId: string }) {
  const items = await Promise.all(
    Array.from({ length: MIN_CHECKPOINT_QUESTIONS + 1 }, () =>
      itemFixture({ content: choiceItemContent(), skillId }),
    ),
  );

  await attemptFixture({
    answeredAt: new Date("2020-10-11T10:00:00Z"),
    itemId: items[0]?.id,
    skillId,
    userId,
  });
}

async function weeklySunday() {
  const setup = await weeklySetup();
  vi.setSystemTime(new Date("2020-10-11T12:00:00Z"));
  return setup;
}

describe("the week's challenge on its Sunday, past today's study time", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps Move to Monday: left unstarted, Monday re-plans without it", async () => {
    const { challenge, goal, skills } = await weeklySunday();

    await Promise.all([
      studyTheWeek({ skillId: skills[0]?.id ?? "", userId: goal.userId }),
      useUpStudyTime({ date: SUNDAY, userId: goal.userId }),
    ]);

    await expect(challengeOf(challenge.id)).resolves.toMatchObject({
      canMove: true,
      dailyLimitReached: true,
      date: "2020-10-11",
      nextStudyDate: null,
      status: "ready",
      today: "2020-10-11",
    });

    vi.setSystemTime(new Date("2020-10-12T12:00:00Z"));

    await expect(startChallenge({ input: {}, planItemId: challenge.id })).resolves.toStrictEqual({
      status: "notToday",
    });

    const monday = await prisma.studySession.findFirstOrThrow({
      include: { blocks: true },
      where: { goalId: goal.id, localDate: new Date("2020-10-12") },
    });

    expect(
      monday.blocks
        .filter((block) => block.kind === "checkpoint")
        .map((block) => readBlockPayload(block).planItemId),
    ).not.toContain(challenge.id);
  });

  it("moved to Monday past today's study time, starts in Monday's session", async () => {
    const { challenge, goal, skills } = await weeklySunday();

    await Promise.all([
      studyTheWeek({ skillId: skills[0]?.id ?? "", userId: goal.userId }),
      useUpStudyTime({ date: SUNDAY, userId: goal.userId }),
    ]);

    const moved = await moveChallenge({ input: {}, planItemId: challenge.id });

    if (moved.status !== "moved" || !moved.move.planItemId) {
      throw new Error(`Expected the challenge to move, got ${moved.status}`);
    }

    expect(moved.move.date).toBe("2020-10-12");

    await expect(getChallenge({ input: {}, planItemId: challenge.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    vi.setSystemTime(new Date("2020-10-12T12:00:00Z"));

    await expect(
      startChallenge({ input: {}, planItemId: moved.move.planItemId }),
    ).resolves.toMatchObject({ status: "ready" });

    const monday = await prisma.studySession.findFirstOrThrow({
      include: { blocks: true },
      where: { goalId: goal.id, localDate: new Date("2020-10-12") },
    });

    expect(
      monday.blocks
        .filter((block) => block.kind === "checkpoint")
        .map((block) => readBlockPayload(block).planItemId),
    ).toContain(moved.move.planItemId);
  });
});

const EXAM_STRUCTURE = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "Right answers", method: "raw" },
    sections: [{ day: null, kind: "objective", minutes: 30, name: "Math", questions: 18 }],
    timeLimitMinutes: 30,
    totalQuestions: 18,
  },
  rules: [],
  subjects: [],
};

const EDITION = {
  check: null,
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
