import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { createSafeDate } from "@zoonk/testing/fixtures/dates";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, test } from "vitest";
import { getScoreHistory } from "./get-score-history";

describe("unauthenticated users", () => {
  test("returns null", async () => {
    const result = await getScoreHistory({
      headers: new Headers(),
      period: "month",
    });
    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  test("returns null when user has no DailyProgress records", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const result = await getScoreHistory({ headers, period: "month" });
    expect(result).toBeNull();
  });

  test("returns null when user has records but no answers", async () => {
    const [user, org] = await Promise.all([
      userFixture(),
      organizationFixture(),
    ]);
    const headers = await signInAs(user.email, user.password);

    const date = new Date();
    await prisma.dailyProgress.create({
      data: {
        correctAnswers: 0,
        date,
        dayOfWeek: date.getDay(),
        incorrectAnswers: 0,
        organizationId: org.id,
        userId: Number(user.id),
      },
    });

    const result = await getScoreHistory({ headers, period: "month" });
    expect(result).toBeNull();
  });

  describe("month period", () => {
    test("returns daily data points for current month", async () => {
      const [user, org] = await Promise.all([
        userFixture(),
        organizationFixture(),
      ]);
      const headers = await signInAs(user.email, user.password);

      const today = createSafeDate(0, 0);
      const yesterday = createSafeDate(0, 1);

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
            correctAnswers: 6,
            date: yesterday,
            dayOfWeek: yesterday.getDay(),

            incorrectAnswers: 4,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getScoreHistory({ headers, period: "month" });

      expect(result).not.toBeNull();
      expect(result?.dataPoints.length).toBe(2);
      // Day 1: 6/10 = 60%, Day 2: 8/10 = 80% → avg = 70%
      expect(result?.average).toBe(70);
    });

    test("calculates score as percentage correctly", async () => {
      const [user, org] = await Promise.all([
        userFixture(),
        organizationFixture(),
      ]);
      const headers = await signInAs(user.email, user.password);

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

      const result = await getScoreHistory({ headers, period: "month" });

      expect(result).not.toBeNull();
      expect(result?.dataPoints[0]?.score).toBe(85);
      expect(result?.average).toBe(85);
    });

    test("calculates comparison with previous month", async () => {
      const [user, org] = await Promise.all([
        userFixture(),
        organizationFixture(),
      ]);
      const headers = await signInAs(user.email, user.password);

      const currentMonth = createSafeDate(0);
      const lastMonth = createSafeDate(1);

      await prisma.dailyProgress.createMany({
        data: [
          {
            correctAnswers: 9,
            date: currentMonth,
            dayOfWeek: currentMonth.getDay(),
            incorrectAnswers: 1,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            correctAnswers: 7,
            date: lastMonth,
            dayOfWeek: lastMonth.getDay(),
            incorrectAnswers: 3,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getScoreHistory({ headers, period: "month" });

      expect(result).not.toBeNull();
      expect(result?.average).toBe(90);
      expect(result?.previousAverage).toBe(70);
    });

    test("navigates to previous month with offset", async () => {
      const [user, org] = await Promise.all([
        userFixture(),
        organizationFixture(),
      ]);
      const headers = await signInAs(user.email, user.password);

      const currentMonth = createSafeDate(0);
      const lastMonth = createSafeDate(1);

      await prisma.dailyProgress.createMany({
        data: [
          {
            correctAnswers: 9,
            date: currentMonth,
            dayOfWeek: currentMonth.getDay(),
            incorrectAnswers: 1,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            correctAnswers: 6,
            date: lastMonth,
            dayOfWeek: lastMonth.getDay(),
            incorrectAnswers: 4,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getScoreHistory({
        headers,
        offset: 1,
        period: "month",
      });

      expect(result).not.toBeNull();
      expect(result?.average).toBe(60);
      expect(result?.hasNextPeriod).toBe(true);
    });
  });

  describe("6months period", () => {
    test("returns weekly aggregated data points", async () => {
      const [user, org] = await Promise.all([
        userFixture(),
        organizationFixture(),
      ]);
      const headers = await signInAs(user.email, user.password);

      const today = new Date();
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

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
            correctAnswers: 7,
            date: oneWeekAgo,
            dayOfWeek: oneWeekAgo.getDay(),
            incorrectAnswers: 3,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getScoreHistory({ headers, period: "6months" });

      expect(result).not.toBeNull();
      expect(result?.dataPoints.length).toBeGreaterThanOrEqual(1);
    });

    test("aggregates weekly scores correctly", async () => {
      const [user, org] = await Promise.all([
        userFixture(),
        organizationFixture(),
      ]);
      const headers = await signInAs(user.email, user.password);

      // Two days in the same week
      const day1 = new Date();
      const day2 = new Date(day1);
      day2.setDate(day2.getDate() - 1);

      await prisma.dailyProgress.createMany({
        data: [
          {
            correctAnswers: 8,
            date: day1,
            dayOfWeek: day1.getDay(),
            incorrectAnswers: 2,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            correctAnswers: 6,
            date: day2,
            dayOfWeek: day2.getDay(),
            incorrectAnswers: 4,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getScoreHistory({ headers, period: "6months" });

      expect(result).not.toBeNull();
      // Week aggregate: (8+6)/(10+10) = 14/20 = 70%
      expect(result?.average).toBe(70);
    });
  });

  describe("year period", () => {
    test("returns monthly aggregated data points", async () => {
      const [user, org] = await Promise.all([
        userFixture(),
        organizationFixture(),
      ]);
      const headers = await signInAs(user.email, user.password);

      const currentMonth = createSafeDate(0);
      const lastMonth = createSafeDate(1);

      await prisma.dailyProgress.createMany({
        data: [
          {
            correctAnswers: 9,
            date: currentMonth,
            dayOfWeek: currentMonth.getDay(),
            incorrectAnswers: 1,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            correctAnswers: 8,
            date: lastMonth,
            dayOfWeek: lastMonth.getDay(),
            incorrectAnswers: 2,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getScoreHistory({ headers, period: "year" });

      expect(result).not.toBeNull();
      expect(result?.dataPoints.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("navigation flags", () => {
    test("hasPreviousPeriod is true when historical data exists", async () => {
      const [user, org] = await Promise.all([
        userFixture(),
        organizationFixture(),
      ]);
      const headers = await signInAs(user.email, user.password);

      const currentMonth = createSafeDate(0);
      const twoMonthsAgo = createSafeDate(2);

      await prisma.dailyProgress.createMany({
        data: [
          {
            correctAnswers: 8,
            date: currentMonth,
            dayOfWeek: currentMonth.getDay(),
            incorrectAnswers: 2,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            correctAnswers: 6,
            date: twoMonthsAgo,
            dayOfWeek: twoMonthsAgo.getDay(),
            incorrectAnswers: 4,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getScoreHistory({ headers, period: "month" });

      expect(result).not.toBeNull();
      expect(result?.hasPreviousPeriod).toBe(true);
    });

    test("hasNextPeriod is false when on current period (offset=0)", async () => {
      const [user, org] = await Promise.all([
        userFixture(),
        organizationFixture(),
      ]);
      const headers = await signInAs(user.email, user.password);

      await prisma.dailyProgress.create({
        data: {
          correctAnswers: 8,
          date: new Date(),
          dayOfWeek: new Date().getDay(),
          incorrectAnswers: 2,
          organizationId: org.id,
          userId: Number(user.id),
        },
      });

      const result = await getScoreHistory({ headers, period: "month" });

      expect(result).not.toBeNull();
      expect(result?.hasNextPeriod).toBe(false);
    });

    test("hasNextPeriod is true when offset > 0", async () => {
      const [user, org] = await Promise.all([
        userFixture(),
        organizationFixture(),
      ]);
      const headers = await signInAs(user.email, user.password);

      const lastMonth = createSafeDate(1);

      await prisma.dailyProgress.create({
        data: {
          correctAnswers: 7,
          date: lastMonth,
          dayOfWeek: lastMonth.getDay(),
          incorrectAnswers: 3,
          organizationId: org.id,
          userId: Number(user.id),
        },
      });

      const result = await getScoreHistory({
        headers,
        offset: 1,
        period: "month",
      });

      expect(result).not.toBeNull();
      expect(result?.hasNextPeriod).toBe(true);
    });
  });

  describe("days with no answers", () => {
    test("excludes days with zero answers from calculations", async () => {
      const [user, org] = await Promise.all([
        userFixture(),
        organizationFixture(),
      ]);
      const headers = await signInAs(user.email, user.password);

      const today = createSafeDate(0, 0);
      const yesterday = createSafeDate(0, 1);

      await prisma.dailyProgress.createMany({
        data: [
          {
            correctAnswers: 10,
            date: today,
            dayOfWeek: today.getDay(),
            incorrectAnswers: 0,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            correctAnswers: 0,
            date: yesterday,
            dayOfWeek: yesterday.getDay(),
            incorrectAnswers: 0,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getScoreHistory({ headers, period: "month" });

      expect(result).not.toBeNull();
      // Only today should be counted (100%)
      expect(result?.dataPoints.length).toBe(1);
      expect(result?.average).toBe(100);
    });
  });
});
