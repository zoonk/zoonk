import { type StudyFreshStart, prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  goalFixture,
  planChangeFixture,
  planFixture,
  plannedSkills,
} from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { toUTCMidnight } from "@zoonk/utils/date";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../_test-utils/learner-lock";
import { mockSession } from "../_test-utils/mock-session";
import { completeBlockMoment } from "./_utils/block-completion";
import { loadCompletionQueue } from "./_utils/completion-queue";
import { readBlockPayload } from "./block-payload";
import { getStudySession } from "./get-study-session";
import { oweDaySettlement } from "./settle-owed-session-day";

const RESULT = {
  brainPower: 0,
  capsulesOpened: 0,
  checkpoint: null,
  comesBackOn: null,
  correct: 0,
  finishedChapter: null,
  netScore: null,
  reminderOffer: null,
  testOutOffer: null,
  topHyperdrive: 0,
  total: 0,
};

describe("the settled completion queue", () => {
  it("includes an append committed while settlement waits and agrees with the full session view", async () => {
    freezeClock();
    const user = await userFixture();
    mockSession(user.id);

    const session = await studySessionFixture({
      localDate: toUTCMidnight(new Date()),
      status: "active",
      userId: user.id,
    });

    const block = await studySessionBlockFixture({
      completedAt: new Date(),
      kind: "review",
      sessionId: session.id,
      status: "completed",
    });

    const lock = holdLearnerLock({
      beforeCommit: (tx) =>
        tx.studySessionBlock.create({
          data: { kind: "practice", position: 1, sessionId: session.id },
        }),
      userId: user.id,
    });

    const pid = await lock.pid;

    const finishing = completeBlockMoment({
      blockId: block.id,
      brainPowerBefore: 0,
      energy: null,
      payload: readBlockPayload(block),
      result: RESULT,
      sessionId: session.id,
      timeZone: "UTC",
      userId: user.id,
    });

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK);
    } finally {
      lock.release();
    }

    await lock.done;
    const completion = await finishing;
    expect(completion.blocks).toHaveLength(2);
    expect(completion.next?.block.kind).toBe("practice");
    expect(completion.nextBlockId).toBe(completion.next?.block.id);
    expect(completion.sessionBar).toStrictEqual({ completed: 1, total: 2 });
    expect(completion.sessionCompleted).toBe(false);
    const view = await getStudySession({ input: { timeZone: "UTC" }, sessionId: session.id });
    expect(view.status === "ready" && view.session.blocks).toStrictEqual(completion.blocks);
  });

  it("owes one session refresh when several block completions commit, and owes none after rollback", async () => {
    const user = await userFixture();
    const session = await studySessionFixture({ userId: user.id });

    const blocks = await Promise.all(
      [0, 1].map((position) => studySessionBlockFixture({ position, sessionId: session.id })),
    );

    await Promise.all(
      blocks.map((block) =>
        prisma.$transaction((tx) =>
          oweDaySettlement(tx, { block, timeZone: "UTC", userId: user.id }),
        ),
      ),
    );

    await expect(
      prisma.followUp.count({
        where: { key: session.id, kind: "refreshStudyDay", userId: user.id },
      }),
    ).resolves.toBe(1);

    const before = await prisma.followUp.findFirstOrThrow({
      where: { kind: "refreshStudyDay", userId: user.id },
    });

    await expect(
      prisma.$transaction(async (tx) => {
        await oweDaySettlement(tx, { block: blocks[0]!, timeZone: "UTC", userId: user.id });
        throw new Error("Roll back completion");
      }),
    ).rejects.toThrow("Roll back completion");

    await expect(prisma.followUp.findUnique({ where: { id: before.id } })).resolves.toStrictEqual(
      before,
    );
  });
});

describe("the day's progress a completion carries", () => {
  const TIME_ZONE = "America/Sao_Paulo";
  const NOW = new Date("2026-11-11T12:00:00Z");
  const TODAY = new Date("2026-11-11T00:00:00Z");

  /** Three five-minute review blocks fill the day's 15 minutes, so it holds no time for more lessons. */
  async function dayWithCarriedLessons({
    freshStart = null,
    resumed = false,
  }: { freshStart?: StudyFreshStart | null; resumed?: boolean } = {}) {
    freezeClock();
    vi.setSystemTime(NOW);
    const user = await userFixture();
    mockSession(user.id);
    const goal = await goalFixture({ dailyMinutes: 15, timezone: TIME_ZONE, userId: user.id });
    const lessons = await Promise.all([0, 1, 2, 3].map(() => libraryLessonFixture()));
    const lessonIds = lessons.map((lesson) => lesson.id);

    const plan = await planFixture({
      goalId: goal.id,
      items: [
        { lessonId: lessonIds[0] },
        // Before the learner's midnight in São Paulo, though on the same UTC day.
        { completedAt: new Date("2026-11-11T02:00:00Z"), lessonId: lessonIds[1], status: "done" },
        { completedAt: new Date("2026-11-11T04:00:00Z"), lessonId: lessonIds[2], status: "done" },
        {
          completedAt: new Date("2026-11-11T05:00:00Z"),
          lessonId: lessonIds[3],
          status: "testedOut",
        },
      ],
    });

    await planChangeFixture({
      kind: "missedDays",
      payload: { carriedItemIds: plan.items.map((item) => item.id), days: 1, source: "system" },
      planId: plan.id,
      status: "applied",
    });

    if (resumed) {
      await planChangeFixture({ kind: "resumed", planId: plan.id, status: "applied" });
    }

    const session = await studySessionFixture({
      freshStart,
      goalId: goal.id,
      localDate: TODAY,
      plannedMinutes: 15,
      status: "active",
      userId: user.id,
    });

    const [block] = await Promise.all(
      [0, 1, 2].map((position) =>
        studySessionBlockFixture({
          completedAt: position === 0 ? NOW : null,
          estimatedMinutes: 5,
          kind: "review",
          position,
          sessionId: session.id,
          status: position === 0 ? "completed" : "pending",
        }),
      ),
    );

    return loadCompletionQueue({
      blockId: block?.id ?? "",
      sessionId: session.id,
      timeZone: TIME_ZONE,
      userId: user.id,
    });
  }

  it("counts carried lessons left and those caught up since the learner's day began", async () => {
    const queue = await dayWithCarriedLessons();

    expect(queue.sessionBar).toStrictEqual({ completed: 1, total: 3 });

    expect(queue.dayProgress).toStrictEqual({
      catchUp: { doneToday: 1, lessonsLeft: 1 },
      lead: "done",
      lessonsComing: false,
      percent: 33,
    });
  });

  it("has no catch-up line on a welcome-back session or after the learner resumed", async () => {
    const [welcomeBack, resumed] = await Promise.all([
      dayWithCarriedLessons({ freshStart: "welcomeBack" }),
      dayWithCarriedLessons({ resumed: true }),
    ]);

    expect(welcomeBack.dayProgress.catchUp).toBeNull();
    expect(resumed.dayProgress.catchUp).toBeNull();
  });

  /** A 30-minute day with one stand-in lesson still to write after a five-minute review. */
  async function dayHoldingALesson({ asked }: { asked: boolean }) {
    freezeClock();
    vi.setSystemTime(NOW);
    const user = await userFixture();
    mockSession(user.id);
    const [course, skill] = await Promise.all([courseFixture(), skillFixture()]);

    const goal = await goalFixture({
      dailyMinutes: 30,
      primaryCourseId: course.id,
      timezone: TIME_ZONE,
      userId: user.id,
    });

    await planFixture({
      goalId: goal.id,
      graph: { skills: plannedSkills([skill]) },
      items: [{ minutes: 10, scheduledFor: TODAY, skillId: skill.id }],
      lessonsAskedAt: asked ? NOW : null,
    });

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: TODAY,
      plannedMinutes: 30,
      status: "active",
      userId: user.id,
    });

    const block = await studySessionBlockFixture({
      completedAt: NOW,
      estimatedMinutes: 5,
      kind: "review",
      sessionId: session.id,
      status: "completed",
    });

    return loadCompletionQueue({
      blockId: block.id,
      sessionId: session.id,
      timeZone: TIME_ZONE,
      userId: user.id,
    });
  }

  it("is open without a total while the day holds time for lessons, coming only once asked for", async () => {
    const [coming, waiting] = await Promise.all([
      dayHoldingALesson({ asked: true }),
      dayHoldingALesson({ asked: false }),
    ]);

    expect(coming.dayProgress).toStrictEqual({
      catchUp: null,
      lead: "open",
      lessonsComing: true,
      percent: null,
    });

    expect(waiting.dayProgress).toStrictEqual({
      catchUp: null,
      lead: "open",
      lessonsComing: false,
      percent: null,
    });
  });
});
