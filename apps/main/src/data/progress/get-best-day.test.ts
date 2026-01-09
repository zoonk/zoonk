import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, test } from "vitest";
import { getBestDay } from "./get-best-day";

describe("unauthenticated users", () => {
  test("returns null", async () => {
    const result = await getBestDay({ headers: new Headers() });
    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  test("returns null when user has no DailyProgress records", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const result = await getBestDay({ headers });
    expect(result).toBeNull();
  });

  test("returns best day when user has data for multiple days", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);
    const org = await organizationFixture();

    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(sunday.getDate() - sunday.getDay());

    const monday = new Date(sunday);
    monday.setDate(monday.getDate() + 1);

    await prisma.dailyProgress.createMany({
      data: [
        {
          correctAnswers: 18,
          date: sunday,
          incorrectAnswers: 2,
          organizationId: org.id,
          userId: Number(user.id),
        },
        {
          correctAnswers: 15,
          date: monday,
          incorrectAnswers: 5,
          organizationId: org.id,
          userId: Number(user.id),
        },
      ],
    });

    const result = await getBestDay({ headers });

    expect(result).not.toBeNull();
    expect(result?.dayOfWeek).toBe(0);
    expect(result?.accuracy).toBe(90);
  });

  test("excludes records older than 90 days", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);
    const org = await organizationFixture();

    const today = new Date();
    const oldDate = new Date(today);
    oldDate.setDate(oldDate.getDate() - 91);

    await prisma.dailyProgress.createMany({
      data: [
        {
          correctAnswers: 8,
          date: today,
          incorrectAnswers: 2,
          organizationId: org.id,
          userId: Number(user.id),
        },
        {
          correctAnswers: 20,
          date: oldDate,
          incorrectAnswers: 0,
          organizationId: org.id,
          userId: Number(user.id),
        },
      ],
    });

    const result = await getBestDay({ headers });

    expect(result).not.toBeNull();
    expect(result?.accuracy).toBe(80);
  });

  test("uses day with most answers as tiebreaker", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);
    const org = await organizationFixture();

    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(sunday.getDate() - sunday.getDay());

    const nextSunday = new Date(sunday);
    nextSunday.setDate(nextSunday.getDate() + 7);

    const monday = new Date(sunday);
    monday.setDate(monday.getDate() + 1);

    await prisma.dailyProgress.createMany({
      data: [
        {
          correctAnswers: 9,
          date: sunday,
          incorrectAnswers: 1,
          organizationId: org.id,
          userId: Number(user.id),
        },
        {
          correctAnswers: 9,
          date: nextSunday,
          incorrectAnswers: 1,
          organizationId: org.id,
          userId: Number(user.id),
        },
        {
          correctAnswers: 8,
          date: monday,
          incorrectAnswers: 2,
          organizationId: org.id,
          userId: Number(user.id),
        },
      ],
    });

    const result = await getBestDay({ headers });

    expect(result).not.toBeNull();
    expect(result?.dayOfWeek).toBe(0);
    expect(result?.accuracy).toBe(90);
  });

  test("returns correct accuracy calculation", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);
    const org = await organizationFixture();

    const today = new Date();

    await prisma.dailyProgress.create({
      data: {
        correctAnswers: 17,
        date: today,
        incorrectAnswers: 3,
        organizationId: org.id,
        userId: Number(user.id),
      },
    });

    const result = await getBestDay({ headers });

    expect(result).not.toBeNull();
    expect(result?.accuracy).toBe(85);
  });
});
