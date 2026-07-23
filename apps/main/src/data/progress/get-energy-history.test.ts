import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { signInAsCurrentUser } from "../../../test-utils/auth";
import { getEnergyHistory } from "./get-energy-history";

const NOW = new Date("2025-01-10T12:00:00Z");

describe("unauthenticated users", () => {
  it("returns null", async () => {
    const result = await getEnergyHistory({ now: NOW });

    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  it("returns null without recorded learning progress", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await userProgressFixture({
      currentEnergy: 0,
      lastActiveAt: NOW,
      totalBrainPower: 0n,
      userId: user.id,
    });

    const result = await getEnergyHistory({ now: NOW });

    expect(result).toBeNull();
  });

  it("keeps current Energy visible when lifetime history predates the calendar", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await Promise.all([
      userProgressFixture({
        currentEnergy: 73,
        lastActiveAt: NOW,
        totalBrainPower: 100n,
        userId: user.id,
      }),
      dailyProgressFixtureMany([
        { date: new Date("2020-01-01T00:00:00Z"), energyAtEnd: 100, userId: user.id },
      ]),
    ]);

    const result = await getEnergyHistory({ now: NOW, timeZone: "Pacific/Kiritimati" });

    expect(result?.currentEnergy).toBe(73);
    expect(result?.days).toHaveLength(371);
    expect(result?.days.every((day) => day.energy === null)).toBe(true);
    expect(result?.days.at(-1)?.date).toStrictEqual(new Date("2025-01-11T00:00:00Z"));
  });

  it("returns live current Energy and a bounded daily calendar", async () => {
    const [user, otherUser] = await Promise.all([userFixture(), userFixture()]);
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await Promise.all([
      userProgressFixture({ currentEnergy: 73, lastActiveAt: NOW, userId: user.id }),
      dailyProgressFixtureMany([
        { date: new Date("2024-01-01T00:00:00Z"), energyAtEnd: 100, userId: user.id },
        { date: new Date("2025-01-05T00:00:00Z"), energyAtEnd: 50, userId: user.id },
        { date: new Date("2025-01-08T00:00:00Z"), energyAtEnd: 0, userId: user.id },
        { date: new Date("2025-01-06T00:00:00Z"), energyAtEnd: 100, userId: otherUser.id },
      ]),
    ]);

    const result = await getEnergyHistory({ now: NOW });

    expect(result?.currentEnergy).toBe(73);
    expect(result?.days).toHaveLength(370);

    expect(result?.days.at(0)).toStrictEqual({
      date: new Date("2024-01-07T00:00:00Z"),
      energy: null,
    });

    expect(
      result?.days.find((day) => day.date.getTime() === new Date("2025-01-05T00:00:00Z").getTime()),
    ).toStrictEqual({ date: new Date("2025-01-05T00:00:00Z"), energy: 50 });

    expect(
      result?.days.find((day) => day.date.getTime() === new Date("2025-01-08T00:00:00Z").getTime()),
    ).toStrictEqual({ date: new Date("2025-01-08T00:00:00Z"), energy: 0 });

    expect(
      result?.days.find((day) => day.date.getTime() === new Date("2025-01-06T00:00:00Z").getTime()),
    ).toStrictEqual({ date: new Date("2025-01-06T00:00:00Z"), energy: null });

    expect(result?.days.some((day) => day.date < new Date("2024-01-07T00:00:00Z"))).toBe(false);
  });

  it("includes the learner's next UTC-date Energy near the server day boundary", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await Promise.all([
      userProgressFixture({ currentEnergy: 80, lastActiveAt: NOW, userId: user.id }),
      dailyProgressFixtureMany([
        { date: new Date("2025-01-11T00:00:00Z"), energyAtEnd: 80, userId: user.id },
      ]),
    ]);

    const result = await getEnergyHistory({ now: NOW, timeZone: "Pacific/Kiritimati" });

    expect(result?.days).toHaveLength(371);

    expect(result?.days.at(-1)).toStrictEqual({
      date: new Date("2025-01-11T00:00:00Z"),
      energy: 80,
    });
  });
});
