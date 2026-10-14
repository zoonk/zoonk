import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { getBuddyStatus } from "../milestones/get-buddy-status";
import { toBlockPayload } from "./block-payload";
import { getStudySession } from "./get-study-session";

describe("review mission progress", () => {
  it("offers no review mission when the day has no scheduled or completed review", async () => {
    freezeClock();
    const user = await userFixture();
    const { goal } = await learnerGoalFixture({ phases: [1], userId: user.id });
    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });
    const lesson = await studySessionBlockFixture({ kind: "learn", sessionId: session.id });
    mockSession(user.id);

    const result = await getStudySession({ input: { timeZone: "UTC" }, sessionId: session.id });

    expect(result).toMatchObject({ status: "ready" });

    // A session built before missions were stored still opens each one where it's done.
    expect(result.status === "ready" && result.session.missions).toStrictEqual([
      {
        done: 0,
        kind: "somethingNew",
        opens: { blockId: lesson.id, kind: "block" },
        status: "todo",
        total: 1,
      },
    ]);
  });

  it("offers no fix mission for mistakes made today, which only become ready tomorrow", async () => {
    freezeClock();
    const user = await userFixture();
    const { goal, items, skills } = await learnerGoalFixture({ phases: [1], userId: user.id });
    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

    const [review] = await Promise.all([
      studySessionBlockFixture({
        kind: "review",
        payload: toBlockPayload({ placementItemIds: items.map((item) => item.id) }),
        sessionId: session.id,
      }),
      mistakeFixture({
        createdAt: new Date(),
        itemId: items[0]?.id,
        skillId: skills[0]?.id,
        userId: user.id,
      }),
    ]);

    mockSession(user.id);

    const result = await getStudySession({ input: { timeZone: "UTC" }, sessionId: session.id });

    expect(result.status === "ready" && result.session.missions).toStrictEqual([
      {
        done: 0,
        kind: "review",
        opens: { blockId: review.id, kind: "block" },
        status: "todo",
        total: 1,
      },
    ]);
  });

  it("offers no missions or bonus on a day with nothing available", async () => {
    freezeClock();
    const user = await userFixture();
    const { goal } = await learnerGoalFixture({ phases: [1], userId: user.id });
    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });
    mockSession(user.id);

    await expect(
      getStudySession({ input: { timeZone: "UTC" }, sessionId: session.id }),
    ).resolves.toMatchObject({
      session: { fullMeal: { bonus: 0, earned: false, ready: false }, missions: [] },
      status: "ready",
    });
  });

  it("offers only completable kinds and keeps the fix mission after its last ready mistake is fixed", async () => {
    freezeClock();
    const user = await userFixture();
    const { goal, items, skills } = await learnerGoalFixture({ phases: [1], userId: user.id });
    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

    const [mistake] = await Promise.all([
      mistakeFixture({
        createdAt: new Date(Date.now() - 86_400_000),
        itemId: items[0]?.id,
        skillId: skills[0]?.id,
        userId: user.id,
      }),
      studySessionBlockFixture({ kind: "learn", position: 0, sessionId: session.id }),
      studySessionBlockFixture({
        kind: "review",
        position: 1,
        sessionId: session.id,
        status: "skipped",
      }),
    ]);

    mockSession(user.id);

    const before = await getStudySession({ input: { timeZone: "UTC" }, sessionId: session.id });

    expect(before).toMatchObject({
      session: {
        fullMeal: { bonus: 50, ready: false },
        missions: [
          { done: 0, kind: "somethingNew", status: "todo", total: 1 },
          { done: 0, kind: "fixMistake", status: "todo", total: 1 },
        ],
      },
      status: "ready",
    });

    await Promise.all([
      prisma.mistake.update({
        data: { fixedAt: new Date(), status: "fixed" },
        where: { id: mistake.id },
      }),
      mistakeFixture({
        createdAt: new Date(),
        itemId: items[1]?.id,
        skillId: skills[0]?.id,
        userId: user.id,
      }),
    ]);

    await expect(
      getStudySession({ input: { timeZone: "UTC" }, sessionId: session.id }),
    ).resolves.toMatchObject({
      session: {
        fullMeal: { bonus: 50, ready: false },
        missions: [
          { done: 0, kind: "somethingNew", status: "todo", total: 1 },
          { done: 1, kind: "fixMistake", status: "done", total: 1 },
        ],
      },
      status: "ready",
    });
  });

  it("counts completed review blocks on Today and Buddy, excluding extra work and reinforcement lessons", async () => {
    freezeClock();
    const user = await userFixture();
    const { goal, items, skills } = await learnerGoalFixture({ phases: [1], userId: user.id });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });
    const skillIds = skills.map((skill) => skill.id);
    const itemIds = items.map((item) => item.id);

    const [, review] = await Promise.all([
      studySessionBlockFixture({
        kind: "review",
        payload: toBlockPayload({
          capsules: itemIds
            .slice(0, 2)
            .map((itemId) => ({
              format: "rapidFire",
              itemIds: [itemId],
              key: itemId,
              lessonId: null,
              skillIds,
              title: "A studied topic",
            })),
        }),
        position: 0,
        sessionId: session.id,
        status: "completed",
      }),
      studySessionBlockFixture({
        kind: "review",
        payload: toBlockPayload({ placementItemIds: itemIds, skillIds }),
        position: 1,
        sessionId: session.id,
        status: "active",
      }),
      studySessionBlockFixture({
        kind: "review",
        payload: toBlockPayload({ extra: true, itemIds, skillIds }),
        position: 2,
        sessionId: session.id,
        status: "pending",
      }),
      studySessionBlockFixture({
        kind: "learn",
        payload: toBlockPayload({ reinforcement: true }),
        position: 3,
        sessionId: session.id,
        status: "completed",
      }),
    ]);

    mockSession(user.id);
    const before = await getStudySession({ input: { timeZone: "UTC" }, sessionId: session.id });

    expect(before).toMatchObject({
      session: { missions: [{ done: 1, kind: "review", status: "todo", total: 2 }] },
      status: "ready",
    });

    await prisma.studySessionBlock.update({
      data: { completedAt: new Date(), status: "completed" },
      where: { id: review!.id },
    });

    const [after, buddy] = await Promise.all([
      getStudySession({ input: { timeZone: "UTC" }, sessionId: session.id }),
      getBuddyStatus({ timeZone: "UTC" }),
    ]);

    expect(after).toMatchObject({
      session: {
        missions: expect.arrayContaining([{ done: 2, kind: "review", status: "done", total: 2 }]),
      },
      status: "ready",
    });

    expect(buddy).toMatchObject({
      buddy: { today: { missions: after.status === "ready" ? after.session.missions : [] } },
      status: "ready",
    });
  });
});
