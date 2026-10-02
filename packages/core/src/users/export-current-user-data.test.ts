import { randomUUID } from "node:crypto";
import { contentFeedbackFixture, feedbackFixture } from "@zoonk/testing/fixtures/feedback";
import { goalFixture, planChangeFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import {
  guardianLinkFixture,
  learningProfileFixture,
} from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture, milestoneFixture } from "@zoonk/testing/fixtures/memory";
import { userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { exportCurrentUserData } from "./export-current-user-data";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/** A learner with something in every part of the export. */
async function createLearnerWithData() {
  const user = await userFixture();
  const goal = await goalFixture({ title: "Pass ENEM", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  await Promise.all([
    learningProfileFixture({ buddyKind: "otto", experienceMode: "fun", userId: user.id }),
    planChangeFixture({ planId: plan.id, reason: "Added a lesson on fractions" }),
    userProgressFixture({ totalBrainPower: 1234n, userId: user.id }),
    learningEventFixture({ userId: user.id }),
    attemptFixture({ userId: user.id }),
    mistakeFixture({ userId: user.id }),
    milestoneFixture({ userId: user.id }),
    memoryFactFixture({ statement: "Wants Law at a public university", userId: user.id }),
    contentFeedbackFixture({ contentId: randomUUID(), userId: user.id, vote: "down" }),
    feedbackFixture({ email: user.email, message: "Loving the new plan", userId: user.id }),
    guardianLinkFixture({ guardianEmail: "parent@zoonk.test", userId: user.id }),
  ]);

  return { goal, user };
}

describe(exportCurrentUserData, () => {
  it("requires a signed-in learner", async () => {
    mockSession(null);
    await expect(exportCurrentUserData()).resolves.toBeNull();
  });

  it("exports everything Zoonk keeps about the learner, without secrets", async () => {
    const { goal, user } = await createLearnerWithData();
    mockSession(user.id);

    const data = await exportCurrentUserData();

    expect(data).toMatchObject({
      account: { email: user.email, name: user.name },
      answers: { attempts: [expect.objectContaining({ userId: user.id })] },
      feedback: {
        contentVotes: [expect.objectContaining({ vote: "down" })],
        messages: [expect.objectContaining({ message: "Loving the new plan" })],
      },
      goals: [
        {
          id: goal.id,
          plan: { changes: [expect.objectContaining({ reason: "Added a lesson on fractions" })] },
          title: "Pass ENEM",
        },
      ],
      guardianLinks: [expect.objectContaining({ guardianEmail: "parent@zoonk.test" })],
      learnerModel: {
        milestones: [expect.objectContaining({ userId: user.id })],
        mistakes: [expect.objectContaining({ userId: user.id })],
      },
      memory: {
        enabled: true,
        facts: [expect.objectContaining({ statement: "Wants Law at a public university" })],
      },
      profile: { buddy: { kind: "otto" }, experienceMode: "fun" },
      progress: {
        learningEvents: [expect.objectContaining({ userId: user.id })],
        totals: { totalBrainPower: 1234 },
      },
    });

    expect(data?.guardianLinks[0]).not.toHaveProperty("tokenHash");
    expect(() => JSON.stringify(data)).not.toThrow();
  });

  it("never includes another learner's data", async () => {
    const [{ user: other }, reader] = await Promise.all([createLearnerWithData(), userFixture()]);
    mockSession(reader.id);

    const data = await exportCurrentUserData();

    expect(JSON.stringify(data)).not.toContain(other.id);

    expect(data).toMatchObject({
      account: { email: reader.email },
      goals: [],
      memory: { facts: [] },
    });
  });
});
