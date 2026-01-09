import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, test } from "vitest";
import { getAccuracy } from "./get-accuracy";

describe("unauthenticated users", () => {
  test("returns null", async () => {
    const result = await getAccuracy({ headers: new Headers() });
    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  test("returns null when user has no DailyProgress records", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const result = await getAccuracy({ headers });
    expect(result).toBeNull();
  });

  test("returns accuracy when user has DailyProgress records", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);
    const org = await organizationFixture();

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await prisma.dailyProgress.createMany({
      data: [
        {
          correctAnswers: 17,
          date: today,
          incorrectAnswers: 3,
          organizationId: org.id,
          userId: Number(user.id),
        },
        {
          correctAnswers: 8,
          date: yesterday,
          incorrectAnswers: 2,
          organizationId: org.id,
          userId: Number(user.id),
        },
      ],
    });

    const result = await getAccuracy({ headers });

    // Total: 25 correct, 5 incorrect = 25/30 = 83.33...%
    expect(result).not.toBeNull();
    expect(result?.accuracy).toBeCloseTo(83.33, 1);
  });

  test("excludes records older than 3 months", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);
    const org = await organizationFixture();

    const today = new Date();
    const oldDate = new Date(today);
    oldDate.setDate(oldDate.getDate() - 91);

    await prisma.dailyProgress.createMany({
      data: [
        {
          correctAnswers: 10,
          date: today,
          incorrectAnswers: 0,
          organizationId: org.id,
          userId: Number(user.id),
        },
        {
          correctAnswers: 0,
          date: oldDate,
          incorrectAnswers: 100,
          organizationId: org.id,
          userId: Number(user.id),
        },
      ],
    });

    const result = await getAccuracy({ headers });

    // Should only count today's data: 10/10 = 100%
    expect(result).not.toBeNull();
    expect(result?.accuracy).toBe(100);
  });
});
