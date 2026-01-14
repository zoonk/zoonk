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

    await prisma.dailyProgress.createMany({
      data: [
        {
          correctAnswers: 18,
          date: new Date("2025-01-05T12:00:00Z"),
          dayOfWeek: 0, // Sunday
          incorrectAnswers: 2,
          organizationId: org.id,
          userId: Number(user.id),
        },
        {
          correctAnswers: 15,
          date: new Date("2025-01-06T12:00:00Z"),
          dayOfWeek: 1, // Monday
          incorrectAnswers: 5,
          organizationId: org.id,
          userId: Number(user.id),
        },
      ],
    });

    const result = await getBestDay({
      headers,
      startDate: new Date("2025-01-01T00:00:00Z"),
    });

    expect(result).not.toBeNull();
    expect(result?.dayOfWeek).toBe(0); // Sunday
    expect(result?.score).toBe(90);
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
          dayOfWeek: today.getDay(),
          incorrectAnswers: 2,
          organizationId: org.id,
          userId: Number(user.id),
        },
        {
          correctAnswers: 20,
          date: oldDate,
          dayOfWeek: oldDate.getDay(),
          incorrectAnswers: 0,
          organizationId: org.id,
          userId: Number(user.id),
        },
      ],
    });

    const result = await getBestDay({ headers });

    expect(result).not.toBeNull();
    expect(result?.score).toBe(80);
  });

  test("uses day with most answers as tiebreaker", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);
    const org = await organizationFixture();

    await prisma.dailyProgress.createMany({
      data: [
        {
          correctAnswers: 9,
          date: new Date("2025-01-05T12:00:00Z"),
          dayOfWeek: 0, // Sunday
          incorrectAnswers: 1,
          organizationId: org.id,
          userId: Number(user.id),
        },
        {
          correctAnswers: 9,
          date: new Date("2025-01-12T12:00:00Z"),
          dayOfWeek: 0, // Next Sunday
          incorrectAnswers: 1,
          organizationId: org.id,
          userId: Number(user.id),
        },
        {
          correctAnswers: 8,
          date: new Date("2025-01-06T12:00:00Z"),
          dayOfWeek: 1, // Monday
          incorrectAnswers: 2,
          organizationId: org.id,
          userId: Number(user.id),
        },
      ],
    });

    const result = await getBestDay({
      headers,
      startDate: new Date("2025-01-01T00:00:00Z"),
    });

    expect(result).not.toBeNull();
    expect(result?.dayOfWeek).toBe(0); // Sunday (more answers than Monday due to two Sundays)
    expect(result?.score).toBe(90);
  });

  test("returns correct score calculation", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);
    const org = await organizationFixture();

    const today = new Date();

    await prisma.dailyProgress.create({
      data: {
        correctAnswers: 17,
        date: today,
        dayOfWeek: today.getDay(),
        incorrectAnswers: 3,
        organizationId: org.id,
        userId: Number(user.id),
      },
    });

    const result = await getBestDay({ headers });

    expect(result).not.toBeNull();
    expect(result?.score).toBe(85);
  });
});
