import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { signedUpFromGuest } from "./signed-up-from-guest";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

describe(signedUpFromGuest, () => {
  it("is true for a new account that received a guest's goal or lessons", async () => {
    const [withGoal, withLesson] = await Promise.all([userFixture(), userFixture()]);

    await Promise.all([
      goalFixture({ userId: withGoal.id }),
      learningEventFixture({ contentIds: {}, userId: withLesson.id }),
    ]);

    mockSession(withGoal.id);
    await expect(signedUpFromGuest()).resolves.toBe(true);

    mockSession(withLesson.id);
    await expect(signedUpFromGuest()).resolves.toBe(true);
  });

  it("is false for a brand-new account and without a session", async () => {
    const fresh = await userFixture();

    mockSession(fresh.id);
    await expect(signedUpFromGuest()).resolves.toBe(false);

    mockSession(null);
    await expect(signedUpFromGuest()).resolves.toBe(false);
  });
});
