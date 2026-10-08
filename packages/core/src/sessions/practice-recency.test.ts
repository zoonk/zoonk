import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  SESSION_NOW,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { readBlockPayload } from "./block-payload";
import { getTodayStudySession } from "./get-today-study-session";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const HOUR_MS = 3_600_000;

describe("today's practice", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("never asks again what the learner answered in the last day, such as placement", async () => {
    const user = await userFixture();

    const { goal, planItems, skills } = await sessionGoalFixture({
      itemsPerSkill: 0,
      lessons: 1,
      userId: user.id,
    });

    const skillId = skills[0]?.id ?? "";

    const [placedToday, placedLastNight, answeredDaysAgo, fresh] = await Promise.all(
      Array.from({ length: 4 }, () => itemFixture({ skillId })),
    );

    await Promise.all([
      prisma.planItem.update({ data: { status: "done" }, where: { id: planItems[0]?.id } }),
      dueSkillFixture({ due: daysAgo(-10), skillId, userId: user.id }),
      attemptFixture({
        answeredAt: new Date(SESSION_NOW.getTime() - 2 * HOUR_MS),
        itemId: placedToday?.id,
        skillId,
        userId: user.id,
      }),
      attemptFixture({
        answeredAt: new Date(SESSION_NOW.getTime() - 20 * HOUR_MS),
        isCorrect: false,
        itemId: placedLastNight?.id,
        skillId,
        userId: user.id,
      }),
      attemptFixture({
        answeredAt: daysAgo(3),
        itemId: answeredDaysAgo?.id,
        skillId,
        userId: user.id,
      }),
    ]);

    mockSession(user.id);

    const today = await getTodayStudySession({ goalId: goal.id });
    const sessionId = today.status === "ready" ? today.session.id : "";

    const practice = await prisma.studySessionBlock.findFirstOrThrow({
      where: { kind: "practice", sessionId },
    });

    expect(new Set(readBlockPayload(practice).itemIds)).toStrictEqual(
      new Set([fresh?.id, answeredDaysAgo?.id]),
    );
  });
});
