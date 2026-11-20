import { prisma } from "@zoonk/db";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  SESSION_NOW,
  SESSION_TODAY,
  dueSkillFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { loadCompletionQueue } from "./_utils/completion-queue";
import { toBlockPayload } from "./block-payload";
import { toDayBlockRef } from "./day-block";
import { getSessionPageView } from "./get-session-page-view";
import { getStudySessionSummary } from "./get-study-session-summary";
import { openStudyBlock } from "./open-block";
import { openStudyDay } from "./open-study-day";

async function savedDay() {
  const [user, blueprint] = await Promise.all([
    userFixture(),
    examBlueprintFixture({
      structure: {
        formats: [],
        mock: {
          adaptive: false,
          citations: [],
          order: null,
          scoring: { description: "", method: "raw" },
          sections: [],
          timeLimitMinutes: 4,
          totalQuestions: 2,
        },
        rules: [],
        subjects: [],
      },
    }),
  ]);

  const { goal, lessons, plan, skills } = await sessionGoalFixture({
    goal: { examBlueprintId: blueprint.id, kind: "exam" },
    lessons: 1,
    userId: user.id,
  });

  const skill = skills[0]!;

  await prisma.planItem.updateMany({
    data: { status: "done" },
    where: { kind: "lesson", planId: plan.id },
  });

  const [session, reserve] = await Promise.all([
    studySessionFixture({
      goalId: goal.id,
      localDate: SESSION_TODAY,
      planVersion: plan.version,
      startedAt: SESSION_NOW,
      status: "active",
      userId: user.id,
    }),
    itemFixture({ examBlueprintId: blueprint.id, mockOnly: true, skillId: skill.id }),
    dueSkillFixture({ skillId: skill.id, userId: user.id }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  const [finished, mock] = await Promise.all([
    studySessionBlockFixture({
      kind: "learn",
      lessonId: lessons[0]?.id,
      position: 0,
      sessionId: session.id,
      status: "completed",
    }),
    studySessionBlockFixture({
      kind: "checkpoint",
      payload: toBlockPayload({
        checkpoint: {
          kind: "weekly",
          mock: true,
          mockIdentity: { day: null, fullLength: false },
          mockQuestions: 1,
          passMark: 1,
          phase: 0,
          rematch: false,
          timeLimitMinutes: 2,
        },
        skillIds: [skill.id],
      }),
      position: 1,
      sessionId: session.id,
    }),
  ]);

  mockSession(user.id);
  return { finished, goal, mock, reserve, session, user };
}

describe("a saved day whose last scheduled mock becomes unavailable", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("previews the review without writing and two opens share it", async () => {
    const { finished, goal, reserve, session } = await savedDay();

    await prisma.studySessionBlock.update({
      data: { kind: "review", lessonId: null },
      where: { id: finished.id },
    });

    const input = { goalId: goal.id, timeZone: "UTC" };

    await expect(getSessionPageView(input)).resolves.toMatchObject({
      session: { nextPosition: 1 },
      status: "ready",
    });

    await prisma.item.update({ data: { retiredAt: SESSION_NOW }, where: { id: reserve.id } });
    const read = await countDatabaseStatements(() => getSessionPageView(input));
    expect(read.writes).toBe(0);
    const day = read.result;

    if (day.status !== "unstarted") {
      throw new Error(day.status);
    }

    const next = day.day.blocks.find((block) => block.position === day.day.nextPosition);
    expect(next).toBeDefined();

    if (!next) {
      throw new Error("Expected the next review");
    }

    expect(next.kind).toBe("review");

    await expect(
      prisma.studySessionBlock.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(2);

    const opens = await Promise.all(
      (["next", "ref"] as const).map((kind) =>
        openStudyDay({
          ...input,
          shownDate: "2026-09-30",
          target:
            kind === "next"
              ? { kind, shown: toDayBlockRef(next) }
              : { kind, ref: toDayBlockRef(next) },
        }),
      ),
    );

    for (const opened of opens) {
      expect(opened).toMatchObject({
        opening: { kind: "session", sessionId: session.id },
        status: "opened",
        target: { position: 2 },
      });
    }

    await expect(
      prisma.studySessionBlock.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(3);

    await prisma.studySessionBlock.update({
      data: { completedAt: SESSION_NOW, status: "completed" },
      where: { sessionPosition: { position: 2, sessionId: session.id } },
    });

    await openStudyDay({ ...input, shownDate: "2026-09-30" });

    await expect(
      prisma.studySessionBlock.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(3);
  });

  it("returns the review as the next action from the preceding block’s completion", async () => {
    const { finished, mock, reserve, session, user } = await savedDay();
    await prisma.item.update({ data: { retiredAt: SESSION_NOW }, where: { id: reserve.id } });

    const queue = await loadCompletionQueue({
      blockId: finished.id,
      sessionId: session.id,
      timeZone: "UTC",
      userId: user.id,
    });

    expect(queue.next?.block.position).toBe(2);
    expect(queue.blocks.find((block) => block.id === mock.id)?.preparing).toBe(true);
  });

  it("ends the session for now after the fallback review while its mock is still preparing", async () => {
    const { goal, mock, reserve, session } = await savedDay();

    await Promise.all([
      prisma.item.update({ data: { retiredAt: SESSION_NOW }, where: { id: reserve.id } }),
      studySessionBlockFixture({
        completedAt: SESSION_NOW,
        kind: "review",
        payload: toBlockPayload({ mockPreparationReview: true }),
        position: 2,
        sessionId: session.id,
        status: "completed",
      }),
    ]);

    const readSummary = () => getStudySessionSummary({ input: {}, sessionId: session.id });

    const waiting = await getSessionPageView({ goalId: goal.id, timeZone: "UTC" });

    expect(waiting).toMatchObject({
      session: { nextBlockId: null, state: "waiting", waitingFor: "mock" },
      status: "ready",
    });

    expect(
      waiting.status === "ready" && waiting.session.blocks.map((block) => block.position),
    ).toStrictEqual([0, 2, 1]);

    await expect(
      openStudyBlock({ target: { kind: "next", sessionId: session.id }, timeZone: "UTC" }),
    ).resolves.toStrictEqual({ opening: { kind: "today" }, status: "ready" });

    await expect(readSummary()).resolves.toMatchObject({
      status: "ready",
      summary: { finished: true, status: "active" },
    });

    await prisma.item.update({ data: { retiredAt: null }, where: { id: reserve.id } });

    await expect(getSessionPageView({ goalId: goal.id, timeZone: "UTC" })).resolves.toMatchObject({
      session: { nextBlockId: mock.id, waitingFor: null },
      status: "ready",
    });

    await expect(readSummary()).resolves.toMatchObject({
      status: "ready",
      summary: { finished: false, status: "active" },
    });
  });
});
