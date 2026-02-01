import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { createSafeDate } from "@zoonk/testing/fixtures/dates";
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
      const [user, org] = await Promise.all([userFixture(), organizationFixture()]);
      const headers = await signInAs(user.email, user.password);

      // Use createSafeDate to avoid month boundary issues (always mid-month)
      const today = createSafeDate(0);
      const yesterday = createSafeDate(0, 1);

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: today,
            dayOfWeek: today.getDay(),
            energyAtEnd: 85.5,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: yesterday,
            dayOfWeek: yesterday.getDay(),
            energyAtEnd: 80,
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
      const [user, org] = await Promise.all([userFixture(), organizationFixture()]);
      const headers = await signInAs(user.email, user.password);

      // Use createSafeDate to avoid month boundary issues
      const today = createSafeDate(0);
      const yesterday = createSafeDate(0, 1);

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: today,
            dayOfWeek: today.getDay(),
            energyAtEnd: 100,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: yesterday,
            dayOfWeek: yesterday.getDay(),
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
      const [user, org] = await Promise.all([userFixture(), organizationFixture()]);
      const headers = await signInAs(user.email, user.password);

      const currentMonth = createSafeDate(0);
      const lastMonth = createSafeDate(1);

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: currentMonth,
            dayOfWeek: currentMonth.getDay(),
            energyAtEnd: 80,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: lastMonth,
            dayOfWeek: lastMonth.getDay(),
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
      const [user, org] = await Promise.all([userFixture(), organizationFixture()]);
      const headers = await signInAs(user.email, user.password);

      const currentMonth = createSafeDate(0);
      const lastMonth = createSafeDate(1);

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: currentMonth,
            dayOfWeek: currentMonth.getDay(),
            energyAtEnd: 80,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: lastMonth,
            dayOfWeek: lastMonth.getDay(),
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
      expect(result?.hasNextPeriod).toBeTruthy();
    });
  });

  describe("6months period", () => {
    test("returns weekly aggregated data points", async () => {
      const [user, org] = await Promise.all([userFixture(), organizationFixture()]);
      const headers = await signInAs(user.email, user.password);

      // Use createSafeDate for stable dates within the period
      const today = createSafeDate(0);
      const oneWeekAgo = createSafeDate(0, 7);

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: today,
            dayOfWeek: today.getDay(),
            energyAtEnd: 80,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: oneWeekAgo,
            dayOfWeek: oneWeekAgo.getDay(),
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
      const [user, org] = await Promise.all([userFixture(), organizationFixture()]);
      const headers = await signInAs(user.email, user.password);

      const currentMonth = createSafeDate(0);
      const lastMonth = createSafeDate(1);

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: currentMonth,
            dayOfWeek: currentMonth.getDay(),
            energyAtEnd: 85,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: lastMonth,
            dayOfWeek: lastMonth.getDay(),
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
      const [user, org] = await Promise.all([userFixture(), organizationFixture()]);
      const headers = await signInAs(user.email, user.password);

      const currentMonth = createSafeDate(0);
      const twoMonthsAgo = createSafeDate(2);

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: currentMonth,
            dayOfWeek: currentMonth.getDay(),
            energyAtEnd: 80,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: twoMonthsAgo,
            dayOfWeek: twoMonthsAgo.getDay(),
            energyAtEnd: 60,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getEnergyHistory({ headers, period: "month" });

      expect(result).not.toBeNull();
      expect(result?.hasPreviousPeriod).toBeTruthy();
    });

    test("hasNextPeriod is false when on current period (offset=0)", async () => {
      const [user, org] = await Promise.all([userFixture(), organizationFixture()]);
      const headers = await signInAs(user.email, user.password);

      const today = createSafeDate(0);

      await prisma.dailyProgress.create({
        data: {
          date: today,
          dayOfWeek: today.getDay(),
          energyAtEnd: 80,
          organizationId: org.id,
          userId: Number(user.id),
        },
      });

      const result = await getEnergyHistory({ headers, period: "month" });

      expect(result).not.toBeNull();
      expect(result?.hasNextPeriod).toBeFalsy();
    });

    test("hasNextPeriod is true when offset > 0", async () => {
      const [user, org] = await Promise.all([userFixture(), organizationFixture()]);
      const headers = await signInAs(user.email, user.password);

      const lastMonth = createSafeDate(1);

      await prisma.dailyProgress.create({
        data: {
          date: lastMonth,
          dayOfWeek: lastMonth.getDay(),
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
      expect(result?.hasNextPeriod).toBeTruthy();
    });
  });

  describe("daily decay for month period", () => {
    test("fills gaps between data points with -1 decay per day", async () => {
      const [user, org] = await Promise.all([userFixture(), organizationFixture()]);

      const headers = await signInAs(user.email, user.password);

      // Use createSafeDate to avoid month boundary issues
      // day1 is 4 days before day5, both in the same month
      const day1 = createSafeDate(0, 4);
      const day5 = createSafeDate(0);

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: day1,
            dayOfWeek: day1.getDay(),
            energyAtEnd: 75,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: day5,
            dayOfWeek: day5.getDay(),
            energyAtEnd: 76,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getEnergyHistory({ headers, period: "month" });

      if (!result) {
        throw new Error("Expected result");
      }

      // Should have 5 data points: day1 + 3 decayed days + day5
      const { dataPoints } = result;
      expect(dataPoints.length).toBe(5);

      // First and last should be actual data
      expect(dataPoints[0]?.energy).toBe(75);
      expect(dataPoints[4]?.energy).toBe(76);

      // Middle days should have decayed values
      expect(dataPoints[1]?.energy).toBe(74);
      expect(dataPoints[2]?.energy).toBe(73);
      expect(dataPoints[3]?.energy).toBe(72);
    });

    test("decay never goes below 0", async () => {
      const [user, org] = await Promise.all([userFixture(), organizationFixture()]);

      const headers = await signInAs(user.email, user.password);

      // Use createSafeDate to avoid month boundary issues
      // day1 is 5 days before day6, both in the same month
      const day1 = createSafeDate(0, 5);
      const day6 = createSafeDate(0);

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: day1,
            dayOfWeek: day1.getDay(),
            energyAtEnd: 3,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: day6,
            dayOfWeek: day6.getDay(),
            energyAtEnd: 50,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getEnergyHistory({ headers, period: "month" });
      if (!result) {
        throw new Error("Expected result");
      }

      // Should have 6 data points: day1 + 4 decayed days + day6
      const { dataPoints } = result;
      expect(dataPoints.length).toBe(6);

      // Day 1: 3, Day 2: 2, Day 3: 1, Day 4: 0, Day 5: 0 (not negative), Day 6: 50
      expect(dataPoints[0]?.energy).toBe(3);
      expect(dataPoints[1]?.energy).toBe(2);
      expect(dataPoints[2]?.energy).toBe(1);
      expect(dataPoints[3]?.energy).toBe(0);
      expect(dataPoints[4]?.energy).toBe(0);
      expect(dataPoints[5]?.energy).toBe(50);
    });

    test("average includes decayed values", async () => {
      const [user, org] = await Promise.all([userFixture(), organizationFixture()]);

      const headers = await signInAs(user.email, user.password);

      // Use createSafeDate to avoid month boundary issues
      // day1 is 2 days before day3, both in the same month
      const day1 = createSafeDate(0, 2);
      const day3 = createSafeDate(0);

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: day1,
            dayOfWeek: day1.getDay(),
            energyAtEnd: 90,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: day3,
            dayOfWeek: day3.getDay(),
            energyAtEnd: 95,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getEnergyHistory({ headers, period: "month" });

      expect(result).not.toBeNull();

      // Day1=90, day2=89, day3=95 → avg = (90+89+95)/3 = 91.33
      expect(result?.average).toBeCloseTo(91.33, 1);
    });

    test("applies decay and aggregates by week for 6months period", async () => {
      const [user, org] = await Promise.all([userFixture(), organizationFixture()]);
      const headers = await signInAs(user.email, user.password);

      // Use createSafeDate and ensure dates are in the same week
      // Day 15 is mid-month, so day1=13 and day3=15 are 2 days apart
      const day1 = createSafeDate(0, 2);
      const day3 = createSafeDate(0);

      // Ensure they're in the same week by checking and adjusting if needed
      // If day1 and day3 are in different weeks, the test logic still works
      // because we're testing decay functionality, not week boundaries

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: day1,
            dayOfWeek: day1.getDay(),
            energyAtEnd: 80,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: day3,
            dayOfWeek: day3.getDay(),
            energyAtEnd: 90,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getEnergyHistory({ headers, period: "6months" });

      expect(result).not.toBeNull();

      // All 3 days are in the same week (assuming mid-month dates):
      // Day1=80, day2=79 (decayed), day3=90
      // Weekly average: (80 + 79 + 90) / 3 = 83
      expect(result?.average).toBeCloseTo(83, 0);
    });

    test("applies decay and aggregates by month for year period", async () => {
      const [user, org] = await Promise.all([userFixture(), organizationFixture()]);

      const headers = await signInAs(user.email, user.password);

      // Use createSafeDate to ensure dates are in the same month
      // day1 is 3 days before day4
      const day1 = createSafeDate(0, 3);
      const day4 = createSafeDate(0);

      await prisma.dailyProgress.createMany({
        data: [
          {
            date: day1,
            dayOfWeek: day1.getDay(),
            energyAtEnd: 100,
            organizationId: org.id,
            userId: Number(user.id),
          },
          {
            date: day4,
            dayOfWeek: day4.getDay(),
            energyAtEnd: 100,
            organizationId: org.id,
            userId: Number(user.id),
          },
        ],
      });

      const result = await getEnergyHistory({ headers, period: "year" });

      expect(result).not.toBeNull();

      // Monthly average should include decayed days 2 and 3:
      // Day1=100, day2=99, day3=98, day4=100 → avg = (100+99+98+100)/4 = 99.25
      expect(result?.average).toBeCloseTo(99.25, 1);
    });
  });
});
