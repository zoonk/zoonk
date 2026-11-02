import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";
import { getSessionPageView } from "./get-session-page-view";
import { openStudyDay } from "./open-study-day";

describe("the learner opens a study day", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("never fixes an empty day in place while its actual plan is not ready", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ timezone: "UTC", userId: user.id });
    await planFixture({ goalId: goal.id });
    mockSession(user.id);
    const input = { goalId: goal.id, keepEmpty: true, shownDate: "2026-09-30", timeZone: "UTC" };
    const preview = await countDatabaseStatements(() => getSessionPageView(input));
    expect.soft(preview.result).toMatchObject({ goal: { id: goal.id }, status: "preparing" });
    expect(preview.writes).toBe(0);
    const opened = await countDatabaseStatements(() => openStudyDay(input));
    expect(opened.result).toStrictEqual({ status: "preparing" });
    expect(opened.writes).toBe(0);
    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
  });

  it("never selects an unannounced next mock", async () => {
    const mockIdentity = { day: 1, fullLength: false };
    const user = await userFixture();
    const { goal, items } = await sessionGoalFixture({ userId: user.id });
    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

    const mock = await studySessionBlockFixture({
      estimatedMinutes: 165,
      kind: "checkpoint",
      payload: {
        checkpoint: {
          kind: "weekly",
          mock: true,
          mockIdentity,
          passMark: 6,
          phase: null,
          rematch: false,
          timeLimitMinutes: 165,
        },
        itemIds: items.map((item) => item.id),
      },
      sessionId: session.id,
    });

    mockSession(user.id);

    const result = await openStudyDay({
      goalId: goal.id,
      shownDate: "2026-09-30",
      target: { kind: "next", shown: null },
      timeZone: "UTC",
    });

    expect(result).toMatchObject({
      sessionId: session.id,
      status: "opened",
      target: null,
      targetStatus: "changed",
    });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: mock.id } }),
    ).resolves.toMatchObject({ startedAt: null, status: "pending" });
  });

  it("creates one real queue on POST and reuses its IDs on a repeated action and read", async () => {
    const user = await userFixture();
    const { goal, lessons } = await sessionGoalFixture({ userId: user.id });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    mockSession(user.id);

    const input = { goalId: goal.id, shownDate: "2026-09-30", timeZone: "UTC" };

    await expect(getSessionPageView(input)).resolves.toMatchObject({
      goal: { id: goal.id, kind: goal.kind },
      status: "unstarted",
    });

    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
    const result = await openStudyDay(input);

    if (result.status !== "opened") {
      throw new Error("Expected the actual owned day to open");
    }

    expect(result.session.blocks.length).toBeGreaterThan(0);
    expect(result.session.blocks.map((block) => block.lessonId)).toContain(lessons[0]?.id);

    const saved = await prisma.studySession.findUniqueOrThrow({
      include: { blocks: { orderBy: { position: "asc" } } },
      where: { id: result.session.id },
    });

    expect(result.session.blocks.map((block) => block.id)).toStrictEqual(
      saved.blocks.map((block) => block.id),
    );

    const again = await openStudyDay(input);
    expect(again.status).toBe("opened");

    if (again.status !== "opened") {
      throw new Error("Expected a repeated action to reuse the day");
    }

    expect(again.session.id).toBe(result.session.id);

    expect(again.session.blocks.map((block) => block.id)).toStrictEqual(
      result.session.blocks.map((block) => block.id),
    );

    const read = await getSessionPageView(input);

    if (read.status !== "ready") {
      throw new Error("Expected the saved queue on the subsequent read");
    }

    expect(read.session.id).toBe(result.session.id);

    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(1);

    await expect(
      prisma.studySession.findUniqueOrThrow({
        include: { blocks: { orderBy: { position: "asc" } } },
        where: { id: saved.id },
      }),
    ).resolves.toStrictEqual(saved);
  });

  it("refuses another learner's goal without opening either learner's day", async () => {
    const owner = await userFixture();
    const { goal } = await sessionGoalFixture({ userId: owner.id });
    const other = await userFixture();
    mockSession(other.id);

    await expect(openStudyDay({ goalId: goal.id, shownDate: "2026-09-30" })).resolves.toStrictEqual(
      { status: "notFound" },
    );

    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
  });
});
