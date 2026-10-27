import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { calculateBeltLevel } from "@zoonk/utils/belt-level";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAccountSession,
  mockSession,
  mockSessionFailure,
} from "../../_test-utils/mock-session";
import { mistakeListInputSchema } from "../../mistakes/contract";
import { listCurrentUserMistakes } from "../../mistakes/list-current-user-mistakes";
import { lapsedDayFixture } from "../../sessions/_test-utils/entitlement-lapse";
import { SESSION_NOW } from "../../sessions/_test-utils/session-goal";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { getLearnerSummary } from "./get-learner-summary";

const NOW = new Date("2026-03-10T12:00:00.000Z");
const TODAY = new Date("2026-03-10T00:00:00.000Z");
const YESTERDAY = new Date("2026-03-09T00:00:00.000Z");
const SIGNED_IN_AT = new Date("2026-03-01T08:00:00.000Z");
const SESSION_ENDS_AT = new Date("2026-04-01T08:00:00.000Z");
const MINUTE_MS = 60_000;

/**
 * The summary's budget: the learner's row, then one wave of reads, then the day's own counts and
 * the active goal's ready mistakes (the notebook's own count, with its plan, when any can be ready).
 */
const SUMMARY_STATEMENT_BUDGET = 25;

/** Without a mistake made before the learner's day, nothing is read for the count. */
const QUIET_SUMMARY_STATEMENT_BUDGET = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

type User = Awaited<ReturnType<typeof userFixture>>;

function signIn(user: User, { isAnonymous = false }: { isAnonymous?: boolean } = {}) {
  mockAccountSession({ expiresAt: SESSION_ENDS_AT, isAnonymous, signedInAt: SIGNED_IN_AT, user });
}

async function learnerWithGoal(attrs: Partial<Parameters<typeof goalFixture>[0]> = {}) {
  const user = await userFixture();
  const goal = await goalFixture({ timezone: "UTC", userId: user.id, ...attrs });
  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  signIn(user);
  return { goal, user };
}

/** Today's session: a lesson done, one review done and one to go, with saved missions. */
async function savedDay({ goalId, userId }: { goalId: string; userId: string }) {
  const day = await studySessionFixture({
    goalId,
    localDate: TODAY,
    missions: {
      picks: [
        { anchor: { blockKind: "learn" }, kind: "somethingNew", total: 1 },
        { anchor: { blockKind: "review" }, kind: "review", total: 2 },
        { anchor: {}, kind: "fixMistake", total: 2 },
      ],
      version: 1,
    },
    startedAt: new Date(NOW.getTime() - 30 * MINUTE_MS),
    userId,
  });

  await Promise.all([
    studySessionBlockFixture({
      kind: "learn",
      position: 0,
      sessionId: day.id,
      status: "completed",
    }),
    studySessionBlockFixture({
      kind: "review",
      position: 1,
      sessionId: day.id,
      status: "completed",
    }),
    studySessionBlockFixture({
      estimatedMinutes: 6,
      kind: "review",
      payload: { title: "Simple interest" },
      position: 2,
      sessionId: day.id,
    }),
  ]);

  return day;
}

describe(getLearnerSummary, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is null for a visitor", async () => {
    mockSession(null);
    await expect(getLearnerSummary()).resolves.toBeNull();
  });

  it("propagates session failures", async () => {
    const error = new Error("Request headers unavailable");
    mockSessionFailure(error);

    await expect(getLearnerSummary()).rejects.toBe(error);
  });

  it("never builds or changes a day that isn't saved", async () => {
    const { goal, user } = await learnerWithGoal();
    const plan = await planFixture({ goalId: goal.id });
    const item = await planItemFixture({ planId: plan.id, scheduledFor: YESTERDAY });

    const counts = await countDatabaseStatements(() => getLearnerSummary());

    // An unsaved day is still today's: Today names the day it builds the same way.
    expect(counts.result).toMatchObject({
      day: { goalId: goal.id, localDate: "2026-03-10" },
      missions: null,
      today: null,
    });

    expect(counts.writes).toBe(0);

    const [sessions, savedItem] = await Promise.all([
      prisma.studySession.count({ where: { userId: user.id } }),
      prisma.planItem.findUniqueOrThrow({ where: { id: item.id } }),
    ]);

    expect(sessions).toBe(0);
    expect(savedItem).toStrictEqual(item);
  });

  it("gives a learner without goals the default buddy and no day", async () => {
    const user = await userFixture();
    signIn(user);

    const summary = await getLearnerSummary();

    expect(summary).toMatchObject({
      account: { email: user.email, image: null, name: user.name },
      activeGoalId: null,
      analytics: { disabled: false, goal: null, plan: "free" },
      buddy: {
        beltColor: "white",
        energy: null,
        glasses: "round",
        kind: "zu",
        name: null,
        studiedToday: false,
      },
      day: null,
      goals: [],
      identity: {
        expiresAt: SESSION_ENDS_AT.getTime(),
        isAnonymous: false,
        signedInAt: SIGNED_IN_AT.getTime(),
        userId: user.id,
      },
      level: null,
      missions: null,
      nextChangeAt: new Date("2026-03-11T00:00:00.000Z").getTime(),
      places: { exam: false, mindMaps: false, speaking: false },
      readAt: NOW.getTime(),
      tier: "free",
      timeZone: null,
      today: null,
    });
  });

  it("names the learner from their row, not the session's older copy of it", async () => {
    const user = await userFixture();
    const image = "https://example.com/learner.png";

    // The session keeps the account for up to an hour: renamed since, on another device.
    signIn({ ...user, name: "Name before" });

    await prisma.user.update({ data: { image, name: "Name now" }, where: { id: user.id } });

    const counts = await countDatabaseStatements(() => getLearnerSummary());

    expect(counts.result?.account).toStrictEqual({ email: user.email, image, name: "Name now" });
    expect(counts.writes).toBe(0);
    assertReadBudget(counts, QUIET_SUMMARY_STATEMENT_BUDGET);
  });

  it("reads a guest's tier and identity without a subscription lookup", async () => {
    const user = await userFixture();
    signIn(user, { isAnonymous: true });

    const counts = await countDatabaseStatements(() => getLearnerSummary());

    expect(counts.result).toMatchObject({ identity: { isAnonymous: true }, tier: "guest" });
    assertReadBudget(counts, SUMMARY_STATEMENT_BUDGET);
  });

  it("reads the saved day's queue and missions within its budget, without writing", async () => {
    const { goal, user } = await learnerWithGoal();
    const day = await savedDay({ goalId: goal.id, userId: user.id });

    await mistakeFixture({
      fixedAt: new Date(NOW.getTime() - 5 * MINUTE_MS),
      status: "fixed",
      userId: user.id,
    });

    const counts = await countDatabaseStatements(() => getLearnerSummary());

    expect(counts.result).toMatchObject({
      activeGoalId: goal.id,
      day: { goalId: goal.id, localDate: TODAY.toISOString().slice(0, 10) },
      goals: [{ id: goal.id, isActive: true, kind: "learn", status: "active", title: goal.title }],
      // The lesson is done, one review of two, one mistake fixed of two.
      missions: { done: 1, total: 3 },
      timeZone: "UTC",
      today: { blocksLeft: 1, next: { minutes: 6, sessionId: day.id, title: "Simple interest" } },
    });

    assertReadBudget(counts, SUMMARY_STATEMENT_BUDGET);
  });

  it("counts the blocks left and goes on with the active one", async () => {
    const { goal, user } = await learnerWithGoal();
    const day = await studySessionFixture({ goalId: goal.id, localDate: TODAY, userId: user.id });

    await Promise.all([
      studySessionBlockFixture({
        payload: { title: "Saved lesson" },
        position: 0,
        sessionId: day.id,
      }),
      studySessionBlockFixture({ position: 1, sessionId: day.id, status: "completed" }),
      studySessionBlockFixture({ position: 2, sessionId: day.id, status: "skipped" }),
      studySessionBlockFixture({
        estimatedMinutes: 7,
        kind: "practice",
        payload: { title: "Later practice" },
        position: 3,
        sessionId: day.id,
        status: "active",
      }),
    ]);

    await expect(getLearnerSummary()).resolves.toMatchObject({
      today: { blocksLeft: 2, next: { minutes: 7, sessionId: day.id, title: "Later practice" } },
    });
  });

  it("reads the day in the goal's own zone", async () => {
    vi.setSystemTime(new Date("2026-03-10T01:15:00.000Z"));
    const { goal, user } = await learnerWithGoal({ timezone: "America/Los_Angeles" });

    const [local] = await Promise.all([
      studySessionFixture({ goalId: goal.id, localDate: YESTERDAY, userId: user.id }),
      studySessionFixture({ goalId: goal.id, localDate: TODAY, userId: user.id }),
    ]);

    await studySessionBlockFixture({ sessionId: local.id });

    await expect(getLearnerSummary()).resolves.toMatchObject({
      timeZone: "America/Los_Angeles",
      today: { next: { sessionId: local.id } },
    });
  });

  it.each(["paused", "completed", "archived"] as const)(
    "has no day for a %s goal",
    async (status) => {
      const { goal, user } = await learnerWithGoal({ status });
      const day = await studySessionFixture({ goalId: goal.id, localDate: TODAY, userId: user.id });
      await studySessionBlockFixture({ sessionId: day.id });

      await expect(getLearnerSummary()).resolves.toMatchObject({ today: null });
    },
  );

  it("has no day for a quick explanation", async () => {
    const { goal, user } = await learnerWithGoal({ kind: "explain" });
    const day = await studySessionFixture({ goalId: goal.id, localDate: TODAY, userId: user.id });
    await studySessionBlockFixture({ sessionId: day.id });

    await expect(getLearnerSummary()).resolves.toMatchObject({ today: null });
  });

  it("never reads another learner's goal picked as active", async () => {
    const { user } = await learnerWithGoal();
    const other = await userFixture();
    const goal = await goalFixture({ timezone: "UTC", userId: other.id });
    const day = await studySessionFixture({ goalId: goal.id, localDate: TODAY, userId: other.id });
    await studySessionBlockFixture({ sessionId: day.id });

    await prisma.userLearningProfile.update({
      data: { activeGoalId: goal.id },
      where: { userId: user.id },
    });

    await expect(getLearnerSummary()).resolves.toMatchObject({
      activeGoalId: null,
      missions: null,
      today: null,
    });
  });

  it("keeps the day before's session while the learner is still in it", async () => {
    const { goal, user } = await learnerWithGoal();

    const yesterday = await studySessionFixture({
      goalId: goal.id,
      localDate: YESTERDAY,
      startedAt: new Date(NOW.getTime() - 40 * MINUTE_MS),
      userId: user.id,
    });

    await studySessionBlockFixture({
      sessionId: yesterday.id,
      startedAt: new Date(NOW.getTime() - 10 * MINUTE_MS),
      status: "active",
    });

    const summary = await getLearnerSummary();

    expect(summary?.today).toMatchObject({ blocksLeft: 1, next: { sessionId: yesterday.id } });

    // Its missions are the night before's day, and say so.
    expect(summary?.day).toStrictEqual({ goalId: goal.id, localDate: "2026-03-09" });
  });

  it("leaves a free language plan's locked challenge out of the day and finds its speaking paper", async () => {
    const { goal, user } = await learnerWithGoal({
      kind: "language",
      targetLanguage: "en",
      title: "English",
    });

    const day = await studySessionFixture({ goalId: goal.id, localDate: TODAY, userId: user.id });

    await Promise.all([
      studySessionBlockFixture({ position: 0, sessionId: day.id }),
      studySessionBlockFixture({
        kind: "checkpoint",
        payload: {
          checkpoint: { kind: "boss", mock: false, passMark: 70, phase: 0, timeLimitMinutes: null },
        },
        position: 1,
        sessionId: day.id,
      }),
    ]);

    const summary = await getLearnerSummary();

    expect(summary).toMatchObject({
      places: { exam: false, speaking: true },
      tier: "free",
      today: { blocksLeft: 1 },
    });
  });

  it("finds the active goal's places", async () => {
    const { goal } = await learnerWithGoal({ kind: "exam" });

    const [plan, finished, started, lesson] = await Promise.all([
      planFixture({ goalId: goal.id }),
      libraryChapterFixture(),
      libraryChapterFixture(),
      libraryLessonFixture({ contentStatus: "completed" }),
    ]);

    await Promise.all([
      chapterLessonFixture({ chapterId: finished.id, lessonId: lesson.id }),
      planItemFixture({ chapterId: finished.id, planId: plan.id, position: 0, status: "done" }),
      planItemFixture({ chapterId: started.id, planId: plan.id, position: 1, status: "todo" }),
    ]);

    const summary = await getLearnerSummary();

    expect(summary?.places).toStrictEqual({
      exam: true,
      mindMaps: true,
      readyMistakes: 0,
      speaking: false,
    });
  });

  it("lists mind maps only once a chapter is finished", async () => {
    const { goal } = await learnerWithGoal();

    const [plan, chapter] = await Promise.all([
      planFixture({ goalId: goal.id }),
      libraryChapterFixture(),
    ]);

    await Promise.all([
      planItemFixture({ chapterId: chapter.id, planId: plan.id, position: 0, status: "done" }),
      planItemFixture({ chapterId: chapter.id, planId: plan.id, position: 1, status: "todo" }),
    ]);

    const summary = await getLearnerSummary();

    expect(summary?.places.mindMaps).toBe(false);
  });

  it("reads a language day with outside-session picks and its speaking paper within budget", async () => {
    const { goal, user } = await learnerWithGoal({
      kind: "language",
      targetLanguage: "en",
      title: "English",
    });

    const day = await studySessionFixture({
      goalId: goal.id,
      localDate: TODAY,
      missions: {
        picks: [
          { anchor: {}, kind: "askBuddy", total: 1 },
          { anchor: {}, kind: "call", total: 1 },
          { anchor: {}, kind: "pronunciation", total: 1 },
          { anchor: {}, kind: "fixMistake", total: 2 },
        ],
        version: 1,
      },
      userId: user.id,
    });

    await studySessionBlockFixture({ sessionId: day.id });

    const counts = await countDatabaseStatements(() => getLearnerSummary());

    expect(counts.result).toMatchObject({
      missions: { done: 0, total: 4 },
      places: { speaking: true },
    });

    assertReadBudget(counts, SUMMARY_STATEMENT_BUDGET);
  });

  it("reads again once a day carried over from the night before stops being the learner's", async () => {
    const { goal, user } = await learnerWithGoal();
    const lastActivity = new Date(NOW.getTime() - 10 * MINUTE_MS);

    const yesterday = await studySessionFixture({
      goalId: goal.id,
      localDate: YESTERDAY,
      startedAt: new Date(NOW.getTime() - 40 * MINUTE_MS),
      userId: user.id,
    });

    await studySessionBlockFixture({
      sessionId: yesterday.id,
      startedAt: lastActivity,
      status: "active",
    });

    await expect(getLearnerSummary()).resolves.toMatchObject({
      nextChangeAt: lastActivity.getTime() + 60 * MINUTE_MS,
    });
  });

  it("draws the buddy from progress and tags analytics with the plan's phase", async () => {
    const { goal, user } = await learnerWithGoal();

    const plan = await planFixture({
      goalId: goal.id,
      phases: [
        { name: "First", summary: "First phase" },
        { name: "Second", summary: "Second phase" },
      ],
    });

    await Promise.all([
      userProgressFixture({
        currentEnergy: 50,
        lastActiveAt: new Date(NOW.getTime() - 60 * MINUTE_MS),
        totalBrainPower: 15_000n,
        userId: user.id,
      }),
      dailyProgressFixtureMany([
        { date: YESTERDAY, timeSpentSeconds: 600, userId: user.id },
        { date: TODAY, timeSpentSeconds: 300, userId: user.id },
      ]),
      planItemFixture({ phase: 0, planId: plan.id, position: 0, status: "done" }),
      planItemFixture({ phase: 1, planId: plan.id, position: 1, status: "todo" }),
    ]);

    const belt = calculateBeltLevel(15_000);
    const summary = await getLearnerSummary();

    expect(summary).toMatchObject({
      analytics: { goal: { kind: "learn", phase: 1 } },
      buddy: { beltColor: belt.color, energy: 50, studiedToday: true },
      level: { color: belt.color, level: belt.level },
    });
  });

  it("shows the buddy's Energy from the learner's first lesson, on that same day", async () => {
    const { user } = await learnerWithGoal();

    await Promise.all([
      userProgressFixture({
        currentEnergy: 2,
        lastActiveAt: new Date(NOW.getTime() - 10 * MINUTE_MS),
        totalBrainPower: 30n,
        userId: user.id,
      }),
      dailyProgressFixtureMany([{ date: TODAY, timeSpentSeconds: 300, userId: user.id }]),
    ]);

    await expect(getLearnerSummary()).resolves.toMatchObject({
      buddy: { energy: 2, studiedToday: true },
    });
  });
});

/** São Paulo's midnight starting NOW's local day (UTC-3). */
const LOCAL_MIDNIGHT = new Date("2026-03-10T03:00:00.000Z");

/** An active goal in São Paulo whose plan has two skills with practice questions. */
async function learnerWithPlannedGoal() {
  const user = await userFixture();
  const fixture = await learnerGoalFixture({ phases: [2], userId: user.id });

  await Promise.all([
    prisma.goal.update({ data: { timezone: "America/Sao_Paulo" }, where: { id: fixture.goal.id } }),
    learningProfileFixture({ activeGoalId: fixture.goal.id, userId: user.id }),
  ]);

  signIn(user);
  return { ...fixture, user };
}

/** What the mistakes notebook counts as ready to practice for the goal. */
async function notebookReady(goalId: string) {
  const notebook = await listCurrentUserMistakes(mistakeListInputSchema.parse({ goalId }));
  return notebook.status === "ready" ? notebook.availability.ready : null;
}

describe("the summary's ready mistakes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts the mistakes the notebook counts as ready, within its budget", async () => {
    const { goal, skills, user } = await learnerWithPlannedGoal();
    const [elsewhere, other] = await Promise.all([skillFixture(), userFixture()]);

    await Promise.all([
      // One second before the learner's local midnight, and the day before: ready.
      mistakeFixture({
        createdAt: new Date(LOCAL_MIDNIGHT.getTime() - 1000),
        skillId: skills[0]?.id,
        userId: user.id,
      }),
      mistakeFixture({ createdAt: YESTERDAY, skillId: skills[1]?.id, userId: user.id }),
      // At local midnight (today), fixed, outside the goal, or someone else's: not counted.
      mistakeFixture({ createdAt: LOCAL_MIDNIGHT, skillId: skills[0]?.id, userId: user.id }),
      mistakeFixture({
        createdAt: YESTERDAY,
        skillId: skills[0]?.id,
        status: "fixed",
        userId: user.id,
      }),
      mistakeFixture({ createdAt: YESTERDAY, skillId: elsewhere.id, userId: user.id }),
      mistakeFixture({ createdAt: YESTERDAY, skillId: skills[0]?.id, userId: other.id }),
    ]);

    const counts = await countDatabaseStatements(() => getLearnerSummary());

    expect(counts.result?.places.readyMistakes).toBe(2);
    await expect(notebookReady(goal.id)).resolves.toBe(2);
    assertReadBudget(counts, SUMMARY_STATEMENT_BUDGET);
  });

  it("reads nothing more while no mistake is ready yet", async () => {
    const { goal, skills, user } = await learnerWithPlannedGoal();

    await mistakeFixture({ createdAt: LOCAL_MIDNIGHT, skillId: skills[0]?.id, userId: user.id });

    const counts = await countDatabaseStatements(() => getLearnerSummary());

    expect(counts.result?.places.readyMistakes).toBe(0);
    await expect(notebookReady(goal.id)).resolves.toBe(0);
    assertReadBudget(counts, QUIET_SUMMARY_STATEMENT_BUDGET);
  });

  it("is read again at the next local midnight, when today's mistakes become ready", async () => {
    const { goal, skills, user } = await learnerWithPlannedGoal();

    await mistakeFixture({ createdAt: LOCAL_MIDNIGHT, skillId: skills[0]?.id, userId: user.id });

    const today = await getLearnerSummary();
    const allowanceResets = new Date("2026-03-11T00:00:00.000Z");
    const nextMidnight = new Date(LOCAL_MIDNIGHT.getTime() + DAY_MS);

    // The allowance starts over at UTC midnight first; read then, it waits for the learner's own.
    expect(today).toMatchObject({
      nextChangeAt: allowanceResets.getTime(),
      places: { readyMistakes: 0 },
    });

    vi.setSystemTime(allowanceResets);

    await expect(getLearnerSummary()).resolves.toMatchObject({
      nextChangeAt: nextMidnight.getTime(),
      places: { readyMistakes: 0 },
    });

    vi.setSystemTime(nextMidnight);

    await expect(getLearnerSummary()).resolves.toMatchObject({ places: { readyMistakes: 1 } });
    await expect(notebookReady(goal.id)).resolves.toBe(1);
  });
});

/**
 * The summary's statements for a Plus learner's saved call day: what it read before it previewed a
 * lapsed day's replacement. The preview's gates are pure, so a day that isn't lapsed reads no more.
 */
const PLUS_CALL_DAY_STATEMENTS = 9;

describe("the summary of a Plus call day", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("names the free lesson Today offers in the call's place once Plus ends, without writing", async () => {
    const day = await lapsedDayFixture();
    const free = day.planItems.at(-1);

    const counts = await countDatabaseStatements(() => getLearnerSummary());

    expect(counts.writes).toBe(0);

    expect(counts.result?.today).toMatchObject({
      blocksLeft: 1,
      next: { sessionId: day.sessionId, title: free?.titleSnapshot },
    });
  });

  it("reads nothing more for the call while Plus is still active", async () => {
    const day = await lapsedDayFixture();

    await prisma.subscription.updateMany({
      data: { status: "active" },
      where: { referenceId: day.user.id },
    });

    const counts = await countDatabaseStatements(() => getLearnerSummary());

    expect(counts.result?.today?.next?.sessionId).toBe(day.sessionId);
    expect(counts.writes).toBe(0);
    expect(counts.statements).toBe(PLUS_CALL_DAY_STATEMENTS);
  });
});
