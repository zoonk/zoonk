import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { signInAsCurrentUser } from "../../../test-utils/auth";
import { getEnergyLevel } from "./get-energy-level";

describe("unauthenticated users", () => {
  it("returns null", async () => {
    const result = await getEnergyLevel();
    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  it("returns null when user has no progress record", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    const result = await getEnergyLevel();
    expect(result).toBeNull();
  });

  it("returns null for zeroed placeholder progress", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await prisma.userProgress.create({ data: { userId: user.id } });

    const result = await getEnergyLevel();
    expect(result).toBeNull();
  });

  it("returns energy unchanged when lastActiveAt is today", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await prisma.userProgress.create({
      data: { currentEnergy: 85.5, lastActiveAt: new Date(), userId: user.id },
    });

    const result = await getEnergyLevel();
    expect(result).toStrictEqual({ currentEnergy: 85.5 });
  });

  it("applies decay when lastActiveAt is 5 days ago", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    // Anchor to UTC midnight so a midnight rollover can't shift the day count
    const today = new Date();

    const todayMidnight = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    const fiveDaysAgo = new Date(todayMidnight.getTime() - 5 * 86_400_000);

    await prisma.userProgress.create({
      data: { currentEnergy: 50, lastActiveAt: fiveDaysAgo, userId: user.id },
    });

    const result = await getEnergyLevel();
    expect(result).toStrictEqual({ currentEnergy: 46 });
  });

  it("clamps decayed energy at 0", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    const today = new Date();

    const todayMidnight = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    const longAgo = new Date(todayMidnight.getTime() - 100 * 86_400_000);

    await prisma.userProgress.create({
      data: { currentEnergy: 20, lastActiveAt: longAgo, userId: user.id },
    });

    const result = await getEnergyLevel();
    expect(result).toStrictEqual({ currentEnergy: 0 });
  });
});
