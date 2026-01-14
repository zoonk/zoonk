import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { createSafeDate } from "@zoonk/testing/fixtures/dates";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, test } from "vitest";
import { getBpHistory } from "./get-bp-history";

describe("unauthenticated users", () => {
  test("returns null", async () => {
    const result = await getBpHistory({
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

    const result = await getBpHistory({ headers, period: "month" });
    expect(result).toBeNull();
  });

  describe("month period", () => {
    test("returns daily data points with BP values", async () => {
      const [user, org] = await Promise.all([
        userFixture(),
        organizationFixture(),
      ]);
      const headers = await signInAs(user.email, user.password);

      const today = createSafeDate(0);
      const yesterday = createSafeDate(0, 1);

      await prisma.dailyProgress.createMany({
        data: [
          {
            brainPowerEarned: 100,
            date: today,
            dayOfWeek: today.getDay(),
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            brainPowerEarned: 50,
            date: yesterday,
            dayOfWeek: yesterday.getDay(),
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getBpHistory({ headers, period: "month" });

      expect(result).not.toBeNull();
      expect(result?.dataPoints.length).toBe(2);
      expect(result?.periodTotal).toBe(150);
    });

    test("calculates period total correctly", async () => {
      const [user, org] = await Promise.all([
        userFixture(),
        organizationFixture(),
      ]);
      const headers = await signInAs(user.email, user.password);

      const today = createSafeDate(0);
      const yesterday = createSafeDate(0, 1);

      await prisma.dailyProgress.createMany({
        data: [
          {
            brainPowerEarned: 200,
            date: today,
            dayOfWeek: today.getDay(),
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            brainPowerEarned: 300,
            date: yesterday,
            dayOfWeek: yesterday.getDay(),
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getBpHistory({ headers, period: "month" });

      expect(result).not.toBeNull();
      expect(result?.periodTotal).toBe(500);
    });

    test("includes current belt level", async () => {
      const [user, org] = await Promise.all([
        userFixture(),
        organizationFixture(),
      ]);
      const headers = await signInAs(user.email, user.password);

      await prisma.userProgress.upsert({
        create: {
          totalBrainPower: 5000,
          userId: Number(user.id),
        },
        update: {
          totalBrainPower: 5000,
        },
        where: { userId: Number(user.id) },
      });

      const date = createSafeDate(0);
      await prisma.dailyProgress.create({
        data: {
          brainPowerEarned: 100,
          date,
          dayOfWeek: date.getDay(),
          organizationId: org.id,
          userId: Number(user.id),
        },
      });

      const result = await getBpHistory({ headers, period: "month" });

      expect(result).not.toBeNull();
      expect(result?.totalBp).toBe(5000);
      expect(result?.currentBelt.color).toBe("yellow");
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
            brainPowerEarned: 200,
            date: currentMonth,
            dayOfWeek: currentMonth.getDay(),
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            brainPowerEarned: 100,
            date: lastMonth,
            dayOfWeek: lastMonth.getDay(),
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getBpHistory({ headers, period: "month" });

      expect(result).not.toBeNull();
      expect(result?.periodTotal).toBe(200);
      expect(result?.previousPeriodTotal).toBe(100);
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
            brainPowerEarned: 300,
            date: currentMonth,
            dayOfWeek: currentMonth.getDay(),
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            brainPowerEarned: 150,
            date: lastMonth,
            dayOfWeek: lastMonth.getDay(),
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getBpHistory({
        headers,
        offset: 1,
        period: "month",
      });

      expect(result).not.toBeNull();
      expect(result?.periodTotal).toBe(150);
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

      const today = createSafeDate(0);
      const oneWeekAgo = createSafeDate(0, 7);

      await prisma.dailyProgress.createMany({
        data: [
          {
            brainPowerEarned: 100,
            date: today,
            dayOfWeek: today.getDay(),
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            brainPowerEarned: 80,
            date: oneWeekAgo,
            dayOfWeek: oneWeekAgo.getDay(),
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getBpHistory({ headers, period: "6months" });

      expect(result).not.toBeNull();
      expect(result?.dataPoints.length).toBeGreaterThanOrEqual(1);
      expect(result?.periodTotal).toBe(180);
    });
  });

  describe("year period", () => {
    test("returns monthly aggregated data points", async () => {
      const [user, org] = await Promise.all([
        userFixture(),
        organizationFixture(),
      ]);
      const headers = await signInAs(user.email, user.password);

      const today = createSafeDate(0);
      const yesterday = createSafeDate(0, 1);

      await prisma.dailyProgress.createMany({
        data: [
          {
            brainPowerEarned: 250,
            date: today,
            dayOfWeek: today.getDay(),
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            brainPowerEarned: 150,
            date: yesterday,
            dayOfWeek: yesterday.getDay(),
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getBpHistory({ headers, period: "year" });

      expect(result).not.toBeNull();
      expect(result?.dataPoints.length).toBe(1);
      expect(result?.periodTotal).toBe(400);
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
            brainPowerEarned: 100,
            date: currentMonth,
            dayOfWeek: currentMonth.getDay(),
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            brainPowerEarned: 50,
            date: twoMonthsAgo,
            dayOfWeek: twoMonthsAgo.getDay(),
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getBpHistory({ headers, period: "month" });

      expect(result).not.toBeNull();
      expect(result?.hasPreviousPeriod).toBe(true);
    });

    test("hasNextPeriod is false when on current period (offset=0)", async () => {
      const [user, org] = await Promise.all([
        userFixture(),
        organizationFixture(),
      ]);
      const headers = await signInAs(user.email, user.password);

      const date = createSafeDate(0);
      await prisma.dailyProgress.create({
        data: {
          brainPowerEarned: 100,
          date,
          dayOfWeek: date.getDay(),
          organizationId: org.id,
          userId: Number(user.id),
        },
      });

      const result = await getBpHistory({ headers, period: "month" });

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
          brainPowerEarned: 75,
          date: lastMonth,
          dayOfWeek: lastMonth.getDay(),
          organizationId: org.id,
          userId: Number(user.id),
        },
      });

      const result = await getBpHistory({
        headers,
        offset: 1,
        period: "month",
      });

      expect(result).not.toBeNull();
      expect(result?.hasNextPeriod).toBe(true);
    });
  });
});
