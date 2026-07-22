import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { signInAsCurrentUser } from "../../../test-utils/auth";
import { getTotalLearningTime } from "./get-total-learning-time";

describe("unauthenticated users", () => {
  it("returns null", async () => {
    const result = await getTotalLearningTime();
    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  it("returns zero when the user has no recorded learning time", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    const result = await getTotalLearningTime();

    expect(result).toStrictEqual({ totalLearningSeconds: 0 });
  });

  it("sums daily learning time for the signed-in user", async () => {
    const [user, otherUser] = await Promise.all([userFixture(), userFixture()]);
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await dailyProgressFixtureMany([
      { date: new Date("2025-01-04T00:00:00Z"), timeSpentSeconds: 120, userId: user.id },
      { date: new Date("2025-01-05T00:00:00Z"), timeSpentSeconds: 45, userId: user.id },
      { date: new Date("2025-01-06T00:00:00Z"), timeSpentSeconds: 300, userId: otherUser.id },
    ]);

    const result = await getTotalLearningTime();

    expect(result).toStrictEqual({ totalLearningSeconds: 165 });
  });
});
