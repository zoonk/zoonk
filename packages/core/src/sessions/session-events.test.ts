import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { trackServerEvent } from "../analytics/server";
import { answerBlockInOrder } from "./_test-utils/answer-block";
import {
  SESSION_NOW,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { addExtraStudyBlock } from "./add-extra-study-block";
import { finishStudyBlock } from "./finish-study-block";
import { getStudySession } from "./get-study-session";
import { getTodayStudySession } from "./get-today-study-session";
import { startStudyBlock } from "./start-study-block";
import { stopStudySession } from "./stop-study-session";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

const MINUTE_MS = 60_000;
const LESSON_SECONDS = 240;

/** A day with capsules, a lesson and a mistake to fix. */
async function setup() {
  const user = await userFixture();
  const fixture = await sessionGoalFixture({ lessons: 2, userId: user.id });
  const [firstSkill] = fixture.skills;

  await Promise.all([
    mistakeFixture({
      createdAt: daysAgo(1),
      itemId: fixture.items[0]?.id,
      skillId: firstSkill?.id,
      userId: user.id,
    }),
    prisma.planItem.update({ data: { status: "done" }, where: { id: fixture.planItems[0]?.id } }),
    dueSkillFixture({ skillId: firstSkill?.id ?? "", userId: user.id }),
  ]);

  mockSession(user.id);
  const result = await getTodayStudySession({ goalId: fixture.goal.id });

  if (result.status !== "ready") {
    throw new Error("Expected today's session");
  }

  return { ...fixture, session: result.session, user };
}

function sentEvents(name: string) {
  return vi
    .mocked(trackServerEvent)
    .mock.calls.map(([event]) => event)
    .filter((event) => event.name === name);
}

/** Time passes while the learner plays a block, so the block's minutes aren't zero. */
function spendMinutes(minutes: number) {
  vi.setSystemTime(new Date(Date.now() + minutes * MINUTE_MS));
}

async function playQuestions({ blockId, sessionId }: { blockId: string; sessionId: string }) {
  await startStudyBlock({ blockId, input: {}, sessionId });
  await answerBlockInOrder({ blockId, sessionId });
  spendMinutes(3);
  await finishStudyBlock({ blockId, input: {}, sessionId });
}

describe("session outcomes sent from the server", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends Session Started once, each Block Completed once and Session Completed, with the goal", async () => {
    const { lessons, session, user } = await setup();
    const [review, learn, practice] = session.blocks;
    const flush = runDeferredWork();

    await playQuestions({ blockId: review?.id ?? "", sessionId: session.id });

    await startStudyBlock({ blockId: learn?.id ?? "", input: {}, sessionId: session.id });
    spendMinutes(4);

    await learningEventFixture({
      contentIds: { lessonId: lessons[1]?.id ?? "" },
      endedAt: new Date(),
      seconds: LESSON_SECONDS,
      userId: user.id,
    });

    await finishStudyBlock({ blockId: learn?.id ?? "", input: {}, sessionId: session.id });
    await playQuestions({ blockId: practice?.id ?? "", sessionId: session.id });

    // Finishing again or stopping a completed session sends nothing new.
    await finishStudyBlock({ blockId: practice?.id ?? "", input: {}, sessionId: session.id });
    await stopStudySession({ input: {}, sessionId: session.id });
    await flush();

    const shared = expect.objectContaining({ goal_kind: "learn" });

    expect(sentEvents("Session Started")).toStrictEqual([
      {
        distinctId: user.id,
        name: "Session Started",
        properties: { blocks: 3, planned_minutes: session.minutes.planned, session_id: session.id },
        shared,
      },
    ]);

    expect(sentEvents("Block Completed").map((event) => event.properties)).toStrictEqual([
      { block_kind: "review", position: 0, seconds: expect.any(Number), session_id: session.id },
      { block_kind: "learn", position: 1, seconds: LESSON_SECONDS, session_id: session.id },
      { block_kind: "practice", position: 2, seconds: expect.any(Number), session_id: session.id },
    ]);

    const ended = await getStudySession({ input: {}, sessionId: session.id });

    if (ended.status !== "ready") {
      throw new Error("Expected the session");
    }

    const { minutes } = ended.session;

    expect(minutes.done).toBeGreaterThan(0);

    expect(sentEvents("Session Completed")).toStrictEqual([
      {
        distinctId: user.id,
        name: "Session Completed",
        // The time the blocks took, which may differ from the plan's minutes the card counts.
        properties: {
          blocks_completed: 3,
          daily_goal_met: expect.any(Boolean),
          minutes: expect.any(Number),
          session_id: session.id,
        },
        shared,
      },
    ]);
  });

  it("counts a finished block's minutes on Today's card and in the week, stopped or not", async () => {
    const { session } = await setup();
    const [review, learn] = session.blocks;

    await playQuestions({ blockId: review?.id ?? "", sessionId: session.id });
    await startStudyBlock({ blockId: learn?.id ?? "", input: {}, sessionId: session.id });
    await stopStudySession({ input: {}, sessionId: session.id });

    const today = await getTodayStudySession({ goalId: session.goalId ?? "" });

    if (today.status !== "ready") {
      throw new Error("Expected today's session");
    }

    // The card's "x of 45 min" counts the review's planned minutes; the week's day counts at
    // least that, or the time it took (3 played, capped at twice its estimate) when that's more.
    const planned = review?.estimatedMinutes ?? 0;
    const played = Math.min(3, planned * 2);

    expect(planned).toBeGreaterThan(0);
    expect(today.session.minutes.done).toBe(planned);

    expect(today.session.week.days.find((day) => day.isToday)).toMatchObject({
      minutes: Math.max(planned, played),
    });

    // The lesson opened when the learner stopped waits, with the rest of the day.
    expect(today.session.nextBlockId).toBe(learn?.id);
  });

  it("stopping for today completes the block in progress, and the session waits", async () => {
    const { session, user } = await setup();
    const [review] = session.blocks;
    const flush = runDeferredWork();

    await startStudyBlock({ blockId: review?.id ?? "", input: {}, sessionId: session.id });
    await answerBlockInOrder({ blockId: review?.id ?? "", sessionId: session.id });
    spendMinutes(2);
    await stopStudySession({ input: {}, sessionId: session.id });
    await flush();

    expect(sentEvents("Block Completed")).toMatchObject([
      { distinctId: user.id, properties: { block_kind: "review", seconds: 120 } },
    ]);

    // The rest of the session is still there to pick up, so it isn't completed.
    expect(sentEvents("Session Completed")).toStrictEqual([]);
  });

  it('counts a session once when "10 more minutes" reopens it and it ends again', async () => {
    const user = await userFixture();
    const { goal } = await sessionGoalFixture({ lessons: 3, userId: user.id });
    mockSession(user.id);

    const today = await getTodayStudySession({ goalId: goal.id });
    const sessionId = today.status === "ready" ? today.session.id : "";
    const flush = runDeferredWork();

    const skipAll = () =>
      prisma.studySessionBlock.updateMany({ data: { status: "skipped" }, where: { sessionId } });

    // Every block left behind finishes the session at the next stop.
    await skipAll();
    await stopStudySession({ input: {}, sessionId });

    await expect(addExtraStudyBlock({ sessionId })).resolves.toMatchObject({ status: "ready" });

    await skipAll();
    await stopStudySession({ input: {}, sessionId });
    await flush();

    expect(sentEvents("Session Completed")).toHaveLength(1);
  });
});
