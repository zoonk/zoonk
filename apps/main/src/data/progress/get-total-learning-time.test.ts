import { signInAs } from "@zoonk/testing/fixtures/auth";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { getTotalLearningTime } from "./get-total-learning-time";

describe("unauthenticated users", () => {
  it("returns null", async () => {
    const result = await getTotalLearningTime({ headers: new Headers() });
    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  it("returns zero when the user has no recorded learning time", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const result = await getTotalLearningTime({ headers });

    expect(result).toStrictEqual({ totalLearningSeconds: 0 });
  });

  it("sums daily learning time for the signed-in user", async () => {
    const [user, otherUser] = await Promise.all([userFixture(), userFixture()]);
    const headers = await signInAs(user.email, user.password);

    await dailyProgressFixtureMany([
      { date: new Date("2025-01-04T00:00:00Z"), timeSpentSeconds: 120, userId: user.id },
      { date: new Date("2025-01-05T00:00:00Z"), timeSpentSeconds: 45, userId: user.id },
      { date: new Date("2025-01-06T00:00:00Z"), timeSpentSeconds: 300, userId: otherUser.id },
    ]);

    const result = await getTotalLearningTime({ headers });

    expect(result).toStrictEqual({ totalLearningSeconds: 165 });
  });
});
