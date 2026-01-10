import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, test } from "vitest";
import { getEnergyHistory } from "./get-energy-history";

describe("unauthenticated users", () => {
  test("returns null", async () => {
    const result = await getEnergyHistory({
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

    const result = await getEnergyHistory({ headers, period: "month" });
    expect(result).toBeNull();
  });

  describe("month period", () => {
    test("returns daily data points for current month", async () => {
      const user = await userFixture();
      const headers = await signInAs(user.email, user.password);
      const org = await organizationFixture();

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: today,
            energyAtEnd: 85.5,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: yesterday,
            energyAtEnd: 80.0,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getEnergyHistory({ headers, period: "month" });

      expect(result).not.toBeNull();
      expect(result?.dataPoints.length).toBeGreaterThanOrEqual(1);
      expect(result?.average).toBeCloseTo(82.75, 1);
    });

    test("calculates average correctly", async () => {
      const user = await userFixture();
      const headers = await signInAs(user.email, user.password);
      const org = await organizationFixture();

      const today = new Date();

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: today,
            energyAtEnd: 100,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: new Date(today.getTime() - 24 * 60 * 60 * 1000),
            energyAtEnd: 50,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getEnergyHistory({ headers, period: "month" });

      expect(result).not.toBeNull();
      expect(result?.average).toBe(75);
    });

    test("calculates comparison with previous month", async () => {
      const user = await userFixture();
      const headers = await signInAs(user.email, user.password);
      const org = await organizationFixture();

      const today = new Date();
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: today,
            energyAtEnd: 80,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: lastMonth,
            energyAtEnd: 60,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getEnergyHistory({ headers, period: "month" });

      expect(result).not.toBeNull();
      expect(result?.average).toBe(80);
      expect(result?.previousAverage).toBe(60);
    });

    test("navigates to previous month with offset", async () => {
      const user = await userFixture();
      const headers = await signInAs(user.email, user.password);
      const org = await organizationFixture();

      const today = new Date();
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: today,
            energyAtEnd: 80,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: lastMonth,
            energyAtEnd: 60,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getEnergyHistory({
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
      const user = await userFixture();
      const headers = await signInAs(user.email, user.password);
      const org = await organizationFixture();

      const today = new Date();
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: today,
            energyAtEnd: 80,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: oneWeekAgo,
            energyAtEnd: 70,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getEnergyHistory({ headers, period: "6months" });

      expect(result).not.toBeNull();
      expect(result?.dataPoints.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("year period", () => {
    test("returns monthly aggregated data points", async () => {
      const user = await userFixture();
      const headers = await signInAs(user.email, user.password);
      const org = await organizationFixture();

      const today = new Date();
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: today,
            energyAtEnd: 85,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: lastMonth,
            energyAtEnd: 75,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getEnergyHistory({ headers, period: "year" });

      expect(result).not.toBeNull();
      expect(result?.dataPoints.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("navigation flags", () => {
    test("hasPreviousPeriod is true when historical data exists", async () => {
      const user = await userFixture();
      const headers = await signInAs(user.email, user.password);
      const org = await organizationFixture();

      const today = new Date();
      const twoMonthsAgo = new Date(today);
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: today,
            energyAtEnd: 80,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: twoMonthsAgo,
            energyAtEnd: 60,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getEnergyHistory({ headers, period: "month" });

      expect(result).not.toBeNull();
      expect(result?.hasPreviousPeriod).toBe(true);
    });

    test("hasNextPeriod is false when on current period (offset=0)", async () => {
      const user = await userFixture();
      const headers = await signInAs(user.email, user.password);
      const org = await organizationFixture();

      await prisma.dailyProgress.create({
        data: {
          date: new Date(),
          energyAtEnd: 80,
          organizationId: org.id,
          userId: Number(user.id),
        },
      });

      const result = await getEnergyHistory({ headers, period: "month" });

      expect(result).not.toBeNull();
      expect(result?.hasNextPeriod).toBe(false);
    });

    test("hasNextPeriod is true when offset > 0", async () => {
      const user = await userFixture();
      const headers = await signInAs(user.email, user.password);
      const org = await organizationFixture();

      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      await prisma.dailyProgress.create({
        data: {
          date: lastMonth,
          energyAtEnd: 70,
          organizationId: org.id,
          userId: Number(user.id),
        },
      });

      const result = await getEnergyHistory({
        headers,
        offset: 1,
        period: "month",
      });

      expect(result).not.toBeNull();
      expect(result?.hasNextPeriod).toBe(true);
    });
  });
});
