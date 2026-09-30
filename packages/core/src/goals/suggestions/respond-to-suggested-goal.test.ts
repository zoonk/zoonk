import { prisma } from "@zoonk/db";
import { suggestedGoalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getCurrentSuggestedGoal } from "./get-current-suggested-goal";
import { respondToSuggestedGoal } from "./respond-to-suggested-goal";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

const DAY_MS = 24 * 60 * 60 * 1000;

/** A learner with two courses from before goals existed, the most recent one first. */
async function setup() {
  const user = await userFixture();
  const now = Date.now();

  const [physics, chemistry] = await Promise.all([
    suggestedGoalFixture({
      lastActiveAt: new Date(now - DAY_MS),
      title: "Physics",
      userId: user.id,
    }),
    suggestedGoalFixture({
      lastActiveAt: new Date(now - 3 * DAY_MS),
      title: "Chemistry",
      userId: user.id,
    }),
  ]);

  mockSession(user.id);
  return { chemistry, physics, user };
}

describe(respondToSuggestedGoal, () => {
  it("refuses a visitor without a session", async () => {
    mockSession(null);

    await expect(
      respondToSuggestedGoal({ input: { status: "accepted" }, suggestionId: crypto.randomUUID() }),
    ).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("records the answer once and offers the next course", async () => {
    const { chemistry, physics } = await setup();

    await expect(getCurrentSuggestedGoal()).resolves.toMatchObject({ id: physics.id });

    await expect(
      respondToSuggestedGoal({ input: { status: "accepted" }, suggestionId: physics.id }),
    ).resolves.toStrictEqual({
      status: "updated",
      suggestedGoal: { id: physics.id, status: "accepted", title: "Physics" },
    });

    await expect(
      prisma.suggestedGoal.findUniqueOrThrow({ where: { id: physics.id } }),
    ).resolves.toMatchObject({ respondedAt: expect.any(Date), status: "accepted" });

    await expect(getCurrentSuggestedGoal()).resolves.toStrictEqual({
      id: chemistry.id,
      status: "pending",
      title: "Chemistry",
    });

    await expect(
      respondToSuggestedGoal({ input: { status: "dismissed" }, suggestionId: physics.id }),
    ).resolves.toStrictEqual({ status: "alreadyAnswered" });
  });

  it("shows nothing once every suggestion is answered", async () => {
    const { chemistry, physics } = await setup();

    await Promise.all(
      [physics, chemistry].map((suggestion) =>
        respondToSuggestedGoal({ input: { status: "dismissed" }, suggestionId: suggestion.id }),
      ),
    );

    await expect(getCurrentSuggestedGoal()).resolves.toBeNull();
  });

  it("never answers another learner's suggestion", async () => {
    const { physics } = await setup();
    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(
      respondToSuggestedGoal({ input: { status: "accepted" }, suggestionId: physics.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      prisma.suggestedGoal.findUniqueOrThrow({ where: { id: physics.id } }),
    ).resolves.toMatchObject({ respondedAt: null, status: "pending" });
  });

  it("finds nothing for an id that isn't a suggestion", async () => {
    await setup();

    await expect(
      respondToSuggestedGoal({ input: { status: "accepted" }, suggestionId: "not-a-uuid" }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
