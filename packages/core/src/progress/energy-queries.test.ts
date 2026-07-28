import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getContributionCalendarDateRange } from "@zoonk/utils/contribution-calendar";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getEnergyData } from "./get-energy-data";
import { getEnergyLevel } from "./get-energy-level";
import { getRequestProgressDateContext } from "./get-request-date-context";

const NOW = new Date("2025-01-10T12:00:00Z");

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("./get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

/** Selects the learner and local date used by one private Energy read. */
function mockEnergyRequest({
  currentDate,
  timeZone = "UTC",
  userId,
}: {
  currentDate: Date;
  timeZone?: string;
  userId: string;
}) {
  mockSession(userId);

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate,
    currentInstant: NOW,
    timeZone,
  });
}

describe(getEnergyData, () => {
  it("returns null without an authoritative Energy cursor", async () => {
    const user = await userFixture();
    const dateRange = getContributionCalendarDateRange({ now: NOW });
    mockEnergyRequest({ currentDate: dateRange.endDate, userId: user.id });

    await expect(getEnergyData()).resolves.toBeNull();
  });

  it("returns current Energy when historical daily rows are unavailable", async () => {
    const user = await userFixture();
    const dateRange = getContributionCalendarDateRange({ now: NOW });
    mockEnergyRequest({ currentDate: dateRange.endDate, userId: user.id });

    await userProgressFixture({
      currentEnergy: 70,
      lastActiveAt: new Date("2025-01-10T12:00:00Z"),
      userId: user.id,
    });

    const result = await getEnergyData();

    expect(result?.currentEnergy).toBe(70);
    expect(result?.days).toHaveLength(370);
    expect(result?.days.every((day) => day.energy === null)).toBe(true);
    expect(result?.insights).toBeNull();
  });

  it("derives current Energy, visible gaps, and the lifetime average from sparse cursors", async () => {
    const [user, otherUser] = await Promise.all([userFixture(), userFixture()]);
    const currentDate = getContributionCalendarDateRange({ now: NOW }).endDate;
    mockEnergyRequest({ currentDate, userId: user.id });

    await Promise.all([
      userProgressFixture({
        currentEnergy: 0,
        lastActiveAt: new Date("2025-01-08T12:00:00Z"),
        totalBrainPower: 1n,
        userId: user.id,
      }),
      dailyProgressFixtureMany([
        { date: new Date("2025-01-05T00:00:00Z"), energyAtEnd: 50, userId: user.id },
        { date: new Date("2025-01-08T00:00:00Z"), energyAtEnd: 0, userId: user.id },
        { date: new Date("2025-01-06T00:00:00Z"), energyAtEnd: 100, userId: otherUser.id },
      ]),
    ]);

    const result = await getEnergyData();

    expect(result?.currentEnergy).toBe(0);
    expect(result?.days).toHaveLength(370);
    expect(result?.insights).toStrictEqual({ averageEnergy: 29.4, fullEnergyDays: 0 });

    expect(
      result?.days.find((day) => day.date.getTime() === new Date("2025-01-06").getTime()),
    ).toStrictEqual({ date: new Date("2025-01-06T00:00:00Z"), energy: 49 });

    expect(
      result?.days.find((day) => day.date.getTime() === new Date("2025-01-07").getTime()),
    ).toStrictEqual({ date: new Date("2025-01-07T00:00:00Z"), energy: 48 });

    expect(result?.days.at(-1)).toStrictEqual({
      date: new Date("2025-01-10T00:00:00Z"),
      energy: null,
    });
  });

  it("keeps long zero-Energy tails allocation-bounded while filling the visible year", async () => {
    const user = await userFixture();
    const firstDate = new Date("2020-01-01T00:00:00Z");

    const dateRange = getContributionCalendarDateRange({
      now: NOW,
      timeZone: "Pacific/Kiritimati",
    });

    mockEnergyRequest({
      currentDate: dateRange.endDate,
      timeZone: "Pacific/Kiritimati",
      userId: user.id,
    });

    await Promise.all([
      userProgressFixture({
        currentEnergy: 1,
        lastActiveAt: new Date("2020-01-01T12:00:00Z"),
        userId: user.id,
      }),
      dailyProgressFixtureMany([{ date: firstDate, energyAtEnd: 1, userId: user.id }]),
    ]);

    const result = await getEnergyData();

    const lifetimeDayCount = (dateRange.endDate.getTime() - firstDate.getTime()) / MS_PER_DAY;

    expect(result?.currentEnergy).toBe(0);
    expect(result?.days).toHaveLength(371);
    expect(result?.days.at(0)?.energy).toBe(0);
    expect(result?.days.at(-1)?.energy).toBeNull();

    expect(result?.insights).toStrictEqual({
      averageEnergy: 1 / lifetimeDayCount,
      fullEnergyDays: 0,
    });
  });

  it("keeps later activity authoritative and counts only stored full-Energy days", async () => {
    const user = await userFixture();

    const currentDate = getContributionCalendarDateRange({
      now: new Date("2025-01-12T12:00:00Z"),
    }).endDate;

    mockEnergyRequest({ currentDate, userId: user.id });

    await Promise.all([
      userProgressFixture({
        currentEnergy: 50,
        lastActiveAt: new Date("2025-01-10T12:00:00Z"),
        userId: user.id,
      }),
      dailyProgressFixtureMany([
        { date: new Date("2025-01-05T00:00:00Z"), energyAtEnd: 100, userId: user.id },
        { date: new Date("2025-01-10T00:00:00Z"), energyAtEnd: 50, userId: user.id },
      ]),
    ]);

    const result = await getEnergyData();

    expect(result?.currentEnergy).toBe(49);
    expect(result?.insights?.averageEnergy).toBeCloseTo(589 / 7);
    expect(result?.insights?.fullEnergyDays).toBe(1);
  });

  it("keeps a future cursor current without drawing it into the visible calendar", async () => {
    const user = await userFixture();

    const currentDate = getContributionCalendarDateRange({
      now: new Date("2026-01-11T12:00:00Z"),
    }).endDate;

    mockEnergyRequest({ currentDate, userId: user.id });

    await Promise.all([
      userProgressFixture({
        currentEnergy: 70,
        lastActiveAt: new Date("2026-01-11T12:00:00Z"),
        userId: user.id,
      }),
      dailyProgressFixtureMany([
        { date: new Date("2026-01-10T00:00:00Z"), energyAtEnd: 50, userId: user.id },
        { date: new Date("2026-01-12T00:00:00Z"), energyAtEnd: 70, userId: user.id },
      ]),
    ]);

    const result = await getEnergyData();

    expect(result?.currentEnergy).toBe(70);

    expect(result?.days.at(-1)).toStrictEqual({
      date: new Date("2026-01-11T00:00:00Z"),
      energy: null,
    });
  });
});

describe(getEnergyLevel, () => {
  it("returns null without an authoritative Energy cursor", async () => {
    const user = await userFixture();
    mockEnergyRequest({ currentDate: new Date("2026-07-12T00:00:00Z"), userId: user.id });

    await expect(getEnergyLevel()).resolves.toBeNull();
  });

  it("returns Energy unchanged on a consecutive learner-local day", async () => {
    const user = await userFixture();
    mockEnergyRequest({ currentDate: new Date("2026-07-12T00:00:00Z"), userId: user.id });

    await userProgressFixture({
      currentEnergy: 85.5,
      lastActiveAt: new Date("2026-07-11T12:00:00Z"),
      userId: user.id,
    });

    await expect(getEnergyLevel()).resolves.toStrictEqual({ currentEnergy: 85.5 });
  });

  it("derives current Energy from the persisted completion state", async () => {
    const user = await userFixture();
    mockEnergyRequest({ currentDate: new Date("2026-07-12T00:00:00Z"), userId: user.id });

    await userProgressFixture({
      currentEnergy: 50,
      lastActiveAt: new Date("2026-07-07T12:00:00Z"),
      userId: user.id,
    });

    await expect(getEnergyLevel()).resolves.toStrictEqual({ currentEnergy: 46 });
  });

  it("clamps derived Energy at zero", async () => {
    const user = await userFixture();
    mockEnergyRequest({ currentDate: new Date("2026-07-12T00:00:00Z"), userId: user.id });

    await userProgressFixture({
      currentEnergy: 20,
      lastActiveAt: new Date("2026-01-01T12:00:00Z"),
      userId: user.id,
    });

    await expect(getEnergyLevel()).resolves.toStrictEqual({ currentEnergy: 0 });
  });
});
