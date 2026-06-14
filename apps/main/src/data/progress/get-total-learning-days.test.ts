import { signInAs } from "@zoonk/testing/fixtures/auth";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { getTotalLearningDays } from "./get-total-learning-days";

describe("unauthenticated users", () => {
  it("returns null", async () => {
    const result = await getTotalLearningDays({ headers: new Headers() });
    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  it("returns zero when the user has no completed learning days", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const result = await getTotalLearningDays({ headers });

    expect(result).toStrictEqual({ learningDays: 0 });
  });

  it("counts completed calendar days for the signed-in user", async () => {
    const [user, otherUser] = await Promise.all([userFixture(), userFixture()]);
    const headers = await signInAs(user.email, user.password);

    await dailyProgressFixtureMany([
      { date: new Date("2025-01-04T00:00:00Z"), staticCompleted: 1, userId: user.id },
      { date: new Date("2025-01-05T00:00:00Z"), interactiveCompleted: 1, userId: user.id },
      { date: new Date("2025-01-06T00:00:00Z"), userId: user.id },
      { date: new Date("2025-01-07T00:00:00Z"), staticCompleted: 2, userId: user.id },
      { date: new Date("2025-01-08T00:00:00Z"), interactiveCompleted: 1, userId: otherUser.id },
    ]);

    const result = await getTotalLearningDays({ headers });

    expect(result).toStrictEqual({ learningDays: 3 });
  });
});
