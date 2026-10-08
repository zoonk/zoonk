import { extractMemoryFacts } from "@zoonk/ai/tasks/v2/memory/extraction";
import { generateMemoryInsight } from "@zoonk/ai/tasks/v2/memory/insight";
import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { addExtraStudyBlock } from "./add-extra-study-block";
import { BRAIN_POWER_BONUS } from "./brain-power";
import { finishStudyBlock } from "./finish-study-block";
import { getStudySessionSummary } from "./get-study-session-summary";
import { getTodayStudySession } from "./get-today-study-session";
import { scoreLessonAnswers } from "./score-lesson-answers";
import { settleFinishedLesson } from "./settle-finished-lesson";
import { startStudyBlock } from "./start-study-block";
import { stopStudySession } from "./stop-study-session";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// Memory's extraction and coach are paid model calls, covered by their evals.
vi.mock("@zoonk/ai/tasks/v2/memory/extraction", () => ({ extractMemoryFacts: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/memory/insight", () => ({ generateMemoryInsight: vi.fn() }));

/** A new learner's day one: lessons only, with some Brain Power from before. */
async function setup() {
  const user = await userFixture();
  const fixture = await sessionGoalFixture({ lessons: 3, userId: user.id });

  await userProgressFixture({ currentEnergy: 40, totalBrainPower: 2480n, userId: user.id });
  mockSession(user.id);

  const result = await getTodayStudySession({ goalId: fixture.goal.id });

  if (result.status !== "ready") {
    throw new Error("Expected today's session");
  }

  return { ...fixture, session: result.session, user };
}

describe("ending a session", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("settles a finished lesson: its block, the plan and the day, even outside a session", async () => {
    const { lessons, planItems, session, user } = await setup();
    const [first] = session.blocks;

    expect(first).toMatchObject({ kind: "learn", lessonId: lessons[0]?.id });
    await startStudyBlock({ blockId: first?.id ?? "", input: {}, sessionId: session.id });

    await learningEventFixture({
      brainPower: 40,
      contentIds: { lessonId: lessons[0]?.id ?? "" },
      endedAt: new Date(),
      userId: user.id,
    });

    const moment = await settleFinishedLesson({
      lessonId: lessons[0]?.id ?? "",
      timeZone: "UTC",
      userId: user.id,
    });

    expect(moment).toMatchObject({
      blockId: first?.id,
      brainPower: 40 + BRAIN_POWER_BONUS.fullMeal,
      fullMeal: { paid: true },
      sessionBar: { completed: 1, total: session.blocks.length },
      sessionCompleted: false,
    });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: planItems[0]?.id } }),
    ).resolves.toMatchObject({ status: "done" });

    // A lesson finished outside today's session still checks off its plan item.
    const elsewhere = await sessionGoalFixture({ lessons: 1, userId: user.id });

    await expect(
      settleFinishedLesson({
        lessonId: elsewhere.lessons[0]?.id ?? "",
        timeZone: "UTC",
        userId: user.id,
      }),
    ).resolves.toBeNull();

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: elsewhere.planItems[0]?.id } }),
    ).resolves.toMatchObject({ status: "done" });
  });

  it("stops for today: what was done counts, the rest waits on Today, and the summary says so far", async () => {
    const { lessons, session, user } = await setup();
    const [first, second] = session.blocks;

    await startStudyBlock({ blockId: first?.id ?? "", input: {}, sessionId: session.id });

    await learningEventFixture({
      brainPower: 40,
      contentIds: { lessonId: lessons[0]?.id ?? "" },
      endedAt: new Date(),
      userId: user.id,
    });

    await prisma.userProgress.update({
      data: { totalBrainPower: { increment: 40 } },
      where: { userId: user.id },
    });

    const stopped = await stopStudySession({ input: {}, sessionId: session.id });

    if (stopped.status !== "ready") {
      throw new Error("Expected a summary");
    }

    const stored = await prisma.studySession.findUniqueOrThrow({
      include: { blocks: { orderBy: { position: "asc" } } },
      where: { id: session.id },
    });

    // Nothing is skipped: the session isn't over, only paused for today.
    expect(stored.status).toBe("active");

    expect(stored.blocks.map((block) => block.status)).toStrictEqual([
      "completed",
      "pending",
      "pending",
    ]);

    // Nothing was due and nothing needed fixing, so the lesson alone completes the day's meal.
    expect(stopped.summary).toMatchObject({
      belt: { after: { color: "yellow" }, before: { color: "white" }, colorChanged: true },
      brainPower: 40 + BRAIN_POWER_BONUS.fullMeal,
      capsulesSealed: [{ lessonId: lessons[0]?.id, title: "Lesson 1" }],
      extraTime: { available: false, reason: "sessionNotFinished" },
      finished: false,
      fullMeal: true,
      status: "active",
      tomorrow: { title: "Lesson 2" },
    });

    await expect(
      prisma.learningEvent.findFirst({ where: { kind: "session", userId: user.id } }),
    ).resolves.toMatchObject({ endedAt: null });

    // Today picks the session up where it stopped.
    const today = await getTodayStudySession({ goalId: session.goalId ?? "" });
    expect(today.status === "ready" && today.session.nextBlockId).toBe(second?.id);

    await expect(
      startStudyBlock({ blockId: second?.id ?? "", input: {}, sessionId: session.id }),
    ).resolves.toMatchObject({ status: "ready" });
  });

  it("keeps the summary as the session ended, and counts the day it was finished", async () => {
    const user = await userFixture();
    // The exam is in three days, after the lesson's idea would come back.
    const targetDate = new Date(SESSION_TODAY.getTime() + 3 * DAY_MS);

    const { goal, lessons, skills } = await sessionGoalFixture({
      goal: { dailyMinutes: 45, kind: "exam", targetDate },
      lessons: 2,
      userId: user.id,
    });

    await Promise.all([
      userProgressFixture({ currentEnergy: 40, totalBrainPower: 2480n, userId: user.id }),
      dueSkillFixture({
        due: new Date(SESSION_NOW.getTime() + 10 * DAY_MS),
        skillId: skills[0]?.id ?? "",
        userId: user.id,
      }),
    ]);

    mockSession(user.id);
    const today = await getTodayStudySession({ goalId: goal.id });

    if (today.status !== "ready") {
      throw new Error("Expected today's session");
    }

    const [first, ...rest] = today.session.blocks;

    await prisma.studySessionBlock.updateMany({
      data: { status: "skipped" },
      where: { id: { in: rest.map((block) => block.id) } },
    });

    await startStudyBlock({ blockId: first?.id ?? "", input: {}, sessionId: today.session.id });

    await learningEventFixture({
      brainPower: 40,
      contentIds: { lessonId: lessons[0]?.id ?? "" },
      endedAt: new Date(),
      userId: user.id,
    });

    const finished = await finishStudyBlock({
      blockId: first?.id ?? "",
      input: {},
      sessionId: today.session.id,
    });

    // The idea is due after the exam, so it comes back on the last day before it.
    expect(finished).toMatchObject({
      completion: {
        comesBackOn: new Date(SESSION_TODAY.getTime() + 2 * DAY_MS),
        sessionCompleted: true,
      },
      status: "ready",
    });

    const ended = await getStudySessionSummary({ input: {}, sessionId: today.session.id });

    // A lesson played later moves Brain Power, Energy and skills; the summary keeps the session's.
    await Promise.all([
      prisma.userProgress.update({
        data: { currentEnergy: 90, totalBrainPower: { increment: 5000 } },
        where: { userId: user.id },
      }),
      prisma.learnerSkill.updateMany({ data: { state: "mastered" }, where: { userId: user.id } }),
    ]);

    const later = await getStudySessionSummary({ input: {}, sessionId: today.session.id });

    expect(ended.status === "ready" && ended.summary.belt).toBeTruthy();
    expect(later).toStrictEqual(ended);

    const view = await getTodayStudySession({ goalId: goal.id });

    // 45 minutes a day, done in less: finishing the session counts the day.
    expect(
      view.status === "ready" && view.session.week.days.find((day) => day.isToday),
    ).toMatchObject({ hitGoal: true });
  });

  it("lets memory read the session once, however often the learner stops", async () => {
    const { goal, session, skills, user } = await setup();
    const flush = runDeferredWork();

    // Memory starts off until a learner without an adult's age answer turns it on.
    await learningProfileFixture({ memoryEnabled: true, userId: user.id });

    // A week with answers on two days is enough for memory to read.
    await Promise.all(
      Array.from({ length: 14 }, (_, index) =>
        attemptFixture({
          answeredAt: daysAgo(1 + (index % 2)),
          isCorrect: index % 3 !== 0,
          skillId: skills[0]?.id,
          userId: user.id,
        }),
      ),
    );

    vi.mocked(extractMemoryFacts).mockResolvedValue({
      data: { facts: [] },
      provenance: { generatedAt: "", model: "test", promptVersion: "test", runId: "test" },
    } as unknown as Awaited<ReturnType<typeof extractMemoryFacts>>);

    // Two stops at once (a double tap) and one later: only the first runs memory and the rebalance.
    await Promise.all([
      stopStudySession({ input: {}, sessionId: session.id }),
      stopStudySession({ input: {}, sessionId: session.id }),
    ]);

    await stopStudySession({ input: {}, sessionId: session.id });
    await flush();

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
    ).resolves.toMatchObject({ endedAt: null, stoppedAt: expect.any(Date) });

    expect(extractMemoryFacts).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ source: "session" }),
    );

    expect(generateMemoryInsight).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ goal: goal.title }),
    );
  });

  it("offers ten more minutes only after the day's session, and at most twice", async () => {
    const { session } = await setup();

    await expect(addExtraStudyBlock({ sessionId: session.id })).resolves.toStrictEqual({
      reason: "sessionNotFinished",
      status: "unavailable",
    });

    // Stopping for today leaves the session to pick up, not finished.
    await stopStudySession({ input: {}, sessionId: session.id });

    await expect(addExtraStudyBlock({ sessionId: session.id })).resolves.toStrictEqual({
      reason: "sessionNotFinished",
      status: "unavailable",
    });

    await prisma.studySessionBlock.updateMany({
      data: { status: "skipped" },
      where: { sessionId: session.id },
    });

    const first = await addExtraStudyBlock({ sessionId: session.id });

    expect(first).toMatchObject({
      block: { extra: true, kind: "learn", status: "pending" },
      status: "ready",
    });

    await prisma.studySessionBlock.updateMany({
      data: { status: "skipped" },
      where: { sessionId: session.id },
    });

    await expect(addExtraStudyBlock({ sessionId: session.id })).resolves.toMatchObject({
      status: "ready",
    });

    await prisma.studySessionBlock.updateMany({
      data: { status: "skipped" },
      where: { sessionId: session.id },
    });

    await expect(addExtraStudyBlock({ sessionId: session.id })).resolves.toStrictEqual({
      reason: "dailyCap",
      status: "unavailable",
    });
  });

  it("offers ten more minutes only when something is left to practice or learn", async () => {
    const user = await userFixture();

    const { goal, planItems } = await sessionGoalFixture({
      itemsPerSkill: 0,
      lessons: 1,
      userId: user.id,
    });

    mockSession(user.id);
    const today = await getTodayStudySession({ goalId: goal.id });
    const sessionId = today.status === "ready" ? today.session.id : "";

    await Promise.all([
      prisma.planItem.updateMany({
        data: { status: "done" },
        where: { id: { in: planItems.map((item) => item.id) } },
      }),
      prisma.studySessionBlock.updateMany({ data: { status: "completed" }, where: { sessionId } }),
    ]);

    const nothingLeft = { available: false, minutes: 0, reason: "nothingToStudy" };

    const [summary, view] = await Promise.all([
      getStudySessionSummary({ input: {}, sessionId }),
      getTodayStudySession({ goalId: goal.id }),
    ]);

    expect(summary.status === "ready" && summary.summary.extraTime).toStrictEqual(nothingLeft);
    expect(view.status === "ready" && view.session.extraTime).toStrictEqual(nothingLeft);
  });

  it("names a lesson block's minutes as the lesson says them, as the player does", async () => {
    const { goal, lessons, session } = await setup();
    const [first] = session.blocks;

    await Promise.all([
      prisma.lesson.update({ data: { estimatedMinutes: 7 }, where: { id: lessons[0]?.id } }),
      prisma.studySessionBlock.update({ data: { estimatedMinutes: 4 }, where: { id: first?.id } }),
    ]);

    const today = await getTodayStudySession({ goalId: goal.id });

    expect(today.status === "ready" && today.session.blocks[0]).toMatchObject({
      estimatedMinutes: 7,
      lessonId: lessons[0]?.id,
    });
  });
});

const MS_PER_SECOND = 1000;
const at = (second: number) => new Date(SESSION_NOW.getTime() + second * MS_PER_SECOND);

describe(scoreLessonAnswers, () => {
  it("scores new answers with Hyperdrive and pays replayed questions less", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

    const [known, first, second] = await Promise.all(
      Array.from({ length: 3 }, () => itemFixture({ skillId: skill.id })),
    );

    await attemptFixture({ answeredAt: at(-600), itemId: known?.id, userId: user.id });

    const answer = (itemId: string | undefined, atSecond: number, isCorrect = true) => ({
      answeredAt: at(atSecond),
      id: crypto.randomUUID(),
      isCorrect,
      itemId: itemId ?? null,
      stepId: null,
    });

    const newOnly = await scoreLessonAnswers({
      answers: [answer(first?.id, 1), answer(second?.id, 2), answer(known?.id, 3, false)],
      userId: user.id,
    });

    // x1 then x2 on new questions; a wrong answer earns nothing and costs nothing.
    expect(newOnly).toStrictEqual({ brainPower: 2 + 4, topHyperdrive: 2 });

    const withReplay = await scoreLessonAnswers({
      answers: [answer(known?.id, 1), answer(first?.id, 2)],
      userId: user.id,
    });

    // The replayed question pays 1 and doesn't build Hyperdrive.
    expect(withReplay).toStrictEqual({ brainPower: 1 + 2, topHyperdrive: 1 });
  });
});
