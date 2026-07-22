import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { signInAsCurrentUser } from "../../../test-utils/auth";
import { getBeltLevel } from "./get-belt-level";

describe("unauthenticated users", () => {
  it("returns null", async () => {
    const result = await getBeltLevel();
    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  it("returns null when user has no progress record", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    const result = await getBeltLevel();
    expect(result).toBeNull();
  });

  it("returns belt level when user has progress record", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await prisma.userProgress.create({
      data: { totalBrainPower: BigInt(15_000), userId: user.id },
    });

    const result = await getBeltLevel();

    expect(result).toStrictEqual({
      bpPerLevel: 1000,
      bpToNextLevel: 500,
      color: "orange",
      isMaxLevel: false,
      level: 8,
      progressInLevel: 500,
    });
  });

  it("returns null for zeroed placeholder progress", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await prisma.userProgress.create({ data: { totalBrainPower: BigInt(0), userId: user.id } });

    const result = await getBeltLevel();
    expect(result).toBeNull();
  });
});
