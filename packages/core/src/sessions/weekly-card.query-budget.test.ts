import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getWeeklyChallenge } from "../checkpoints/get-weekly-challenge";
import { readTodayWeeklyChallenge } from "../view-models/today/_utils/weekly-challenge-view";
import { openTodayView } from "./_test-utils/open-today-view";
import {
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";

describe("Today's arrived weekly card", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("projects the actual saved mock instead of selecting the same bank again", async () => {
    const user = await userFixture();

    const { goal, plan } = await sessionGoalFixture({
      goal: { kind: "exam" },
      itemsPerSkill: 10,
      userId: user.id,
    });

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    const item = await checkpointItemFixture({
      kind: "mock",
      planId: plan.id,
      position: 4,
      scheduledFor: SESSION_TODAY,
    });

    mockSession(user.id);

    const opened = await openTodayView({ goalId: goal.id, timeZone: "UTC" });
    const session = opened.today.session;

    const mock = session.blocks.find(
      (block) => block.planItemId === item.id && block.checkpoint?.mock,
    );

    expect(mock).toBeDefined();

    const full = await getWeeklyChallenge({ goalId: goal.id, timeZone: "UTC" });

    if (full.status !== "ready" || !full.challenge) {
      throw new Error("Expected the actual card");
    }

    const card = full.challenge;

    const expected = {
      access: card.access,
      date: card.date,
      kind: card.kind,
      planItemId: card.planItemId,
      questions: card.questions,
      timeLimitMinutes: card.conditions?.timeLimitMinutes ?? null,
      title: card.title,
    };

    const counts = await countDatabaseStatements(() =>
      readTodayWeeklyChallenge({ goalId: goal.id, session, timeZone: "UTC" }),
    );

    expect(counts.result).toStrictEqual(expected);
    assertReadBudget(counts, 2);
  });
});
