import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, test } from "vitest";
import { getBeltLevel } from "./get-belt-level";

describe("unauthenticated users", () => {
  test("returns null", async () => {
    const result = await getBeltLevel({ headers: new Headers() });
    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  test("returns null when user has no progress record", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const result = await getBeltLevel({ headers });
    expect(result).toBeNull();
  });

  test("returns belt level when user has progress record", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    await prisma.userProgress.create({
      data: {
        totalBrainPower: BigInt(15_000),
        userId: Number(user.id),
      },
    });

    const result = await getBeltLevel({ headers });
    expect(result).toEqual({
      bpToNextLevel: 500,
      color: "orange",
      isMaxLevel: false,
      level: 8,
    });
  });

  test("returns white belt level 1 for zero brain power", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    await prisma.userProgress.create({
      data: {
        totalBrainPower: BigInt(0),
        userId: Number(user.id),
      },
    });

    const result = await getBeltLevel({ headers });

    expect(result).toEqual({
      bpToNextLevel: 250,
      color: "white",
      isMaxLevel: false,
      level: 1,
    });
  });
});
