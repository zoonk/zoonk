import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, test } from "vitest";
import { getEnergyLevel } from "./get-energy-level";

describe("unauthenticated users", () => {
  test("returns null", async () => {
    const result = await getEnergyLevel({ headers: new Headers() });
    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  test("returns null when user has no progress record", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const result = await getEnergyLevel({ headers });
    expect(result).toBeNull();
  });

  test("returns energy level when user has progress record", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    await prisma.userProgress.create({
      data: {
        currentEnergy: 85.5,
        userId: Number(user.id),
      },
    });

    const result = await getEnergyLevel({ headers });
    expect(result).toEqual({ currentEnergy: 85.5 });
  });
});
