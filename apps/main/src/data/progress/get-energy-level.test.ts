import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, test } from "vitest";
import { getEnergyLevel } from "./get-energy-level";

describe("unauthenticated users", () => {
  test("returns null", async () => {
    const result = await getEnergyLevel(new Headers());
    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  test("returns null when user has no progress record", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const result = await getEnergyLevel(headers);
    expect(result).toBeNull();
  });

  test("returns energy unchanged when lastActiveAt is today", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    await prisma.userProgress.create({
      data: {
        currentEnergy: 85.5,
        lastActiveAt: new Date(),
        userId: Number(user.id),
      },
    });

    const result = await getEnergyLevel(headers);
    expect(result).toEqual({ currentEnergy: 85.5 });
  });

  test("applies decay when lastActiveAt is 5 days ago", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setUTCDate(fiveDaysAgo.getUTCDate() - 5);

    await prisma.userProgress.create({
      data: {
        currentEnergy: 50,
        lastActiveAt: fiveDaysAgo,
        userId: Number(user.id),
      },
    });

    const result = await getEnergyLevel(headers);
    expect(result).toEqual({ currentEnergy: 46 });
  });

  test("clamps decayed energy at 0", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);
    const longAgo = new Date();
    longAgo.setUTCDate(longAgo.getUTCDate() - 100);

    await prisma.userProgress.create({
      data: {
        currentEnergy: 20,
        lastActiveAt: longAgo,
        userId: Number(user.id),
      },
    });

    const result = await getEnergyLevel(headers);
    expect(result).toEqual({ currentEnergy: 0 });
  });
});
