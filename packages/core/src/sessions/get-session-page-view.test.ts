import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayStudySession } from "./_test-utils/open-today";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";
import { getSessionPageView } from "./get-session-page-view";

async function setup() {
  const user = await userFixture();
  const fixture = await sessionGoalFixture({ userId: user.id });
  await learningProfileFixture({ activeGoalId: fixture.goal.id, userId: user.id });
  mockSession(user.id);

  return { ...fixture, user };
}

function readDay({ goalId, userId }: { goalId: string; userId: string }) {
  return prisma.studySession.findMany({
    include: { blocks: { orderBy: { position: "asc" } } },
    orderBy: { id: "asc" },
    where: { goalId, userId },
  });
}

describe("the narrow session page read", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("reports an unopened day without creating a session", async () => {
    const { goal, user } = await setup();

    await expect(getSessionPageView({})).resolves.toMatchObject({
      goal: { id: goal.id, kind: goal.kind },
      status: "unstarted",
    });

    await expect(readDay({ goalId: goal.id, userId: user.id })).resolves.toStrictEqual([]);
  });

  it("reads the actual saved queue and its lessons' readiness without extending the day", async () => {
    const { goal, user } = await setup();
    const opened = await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });

    if (opened.status !== "ready") {
      throw new Error("Expected the test-owned day to be opened");
    }

    const input = { goalId: goal.id, userId: user.id };
    const before = await readDay(input);
    const result = await getSessionPageView({ goalId: goal.id, timeZone: "UTC" });

    if (result.status !== "ready") {
      throw new Error("Expected the learner's saved session");
    }

    expect(result.goal).toStrictEqual({ id: goal.id, kind: goal.kind });
    expect(result.session.id).toBe(opened.session.id);

    expect(result.session.blocks.map((block) => block.id)).toStrictEqual(
      opened.session.blocks.map((block) => block.id),
    );

    expect(Object.keys(result.lessonStatus).toSorted()).toStrictEqual(
      opened.session.blocks.flatMap((block) => block.lessonId ?? []).toSorted(),
    );

    await expect(readDay(input)).resolves.toStrictEqual(before);
  });

  it("never reveals another learner's goal or creates their day", async () => {
    const { goal, user } = await setup();
    const other = await userFixture();
    mockSession(other.id);

    await expect(getSessionPageView({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(readDay({ goalId: goal.id, userId: user.id })).resolves.toStrictEqual([]);
  });
});
