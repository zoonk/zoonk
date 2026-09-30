import { extractMemoryFacts } from "@zoonk/ai/tasks/v2/memory/extraction";
import { generateMemoryInsight } from "@zoonk/ai/tasks/v2/memory/insight";
import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import {
  SESSION_NOW,
  SESSION_TODAY,
  daysAgo,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { addExtraStudyBlock } from "./add-extra-study-block";
import { BRAIN_POWER_BONUS } from "./brain-power";
import { resetPlannedStudySession } from "./ensure-study-session";
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

  it("stops for today: what was done counts, the rest is skipped, and the summary says what changed", async () => {
    const { lessons, session, user } = await setup();
    const first = session.blocks[0];

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

    expect(stored.status).toBe("completed");

    expect(stored.blocks.map((block) => block.status)).toStrictEqual([
      "completed",
      "skipped",
      "skipped",
    ]);

    // Nothing was due and nothing needed fixing, so the lesson alone completes the day's meal.
    expect(stopped.summary).toMatchObject({
      belt: { after: { color: "yellow" }, before: { color: "white" }, colorChanged: true },
      brainPower: 40 + BRAIN_POWER_BONUS.fullMeal,
      capsulesSealed: [{ lessonId: lessons[0]?.id, title: "Lesson 1" }],
      extraTime: { available: true, minutes: 10 },
      fullMeal: true,
      status: "completed",
      tomorrow: { title: "Lesson 2" },
    });

    await expect(
      prisma.learningEvent.findFirst({ where: { kind: "session", userId: user.id } }),
    ).resolves.toMatchObject({ endedAt: expect.any(Date) });

    const again = await getStudySessionSummary({ input: {}, sessionId: session.id });

    expect(again.status === "ready" && again.summary.brainPower).toBe(
      40 + BRAIN_POWER_BONUS.fullMeal,
    );
  });

  it("lets memory read the session once it ends", async () => {
    const { goal, session, skills, user } = await setup();
    const flush = runDeferredWork();

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

    await stopStudySession({ input: {}, sessionId: session.id });
    await flush();

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

    await stopStudySession({ input: {}, sessionId: session.id });

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

  it("rebuilds a day the learner hasn't started after the plan changes, never a started one", async () => {
    const { goal, session, user } = await setup();

    await resetPlannedStudySession({ goalId: goal.id, localDate: SESSION_TODAY, userId: user.id });
    await expect(prisma.studySession.count({ where: { id: session.id } })).resolves.toBe(0);

    const rebuilt = await getTodayStudySession({ goalId: goal.id });
    const id = rebuilt.status === "ready" ? rebuilt.session.id : "";

    await startStudyBlock({
      blockId: rebuilt.status === "ready" ? (rebuilt.session.blocks[0]?.id ?? "") : "",
      input: {},
      sessionId: id,
    });

    await resetPlannedStudySession({ goalId: goal.id, localDate: SESSION_TODAY, userId: user.id });
    await expect(prisma.studySession.count({ where: { id } })).resolves.toBe(1);
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
