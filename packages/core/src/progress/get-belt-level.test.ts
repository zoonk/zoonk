import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getBeltLevel } from "./get-belt-level";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

describe("unauthenticated users", () => {
  it("returns null", async () => {
    mockSession(null);

    const result = await getBeltLevel();

    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  it("returns null when user has no progress record", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const result = await getBeltLevel();

    expect(result).toBeNull();
  });

  it("returns belt level when user has progress record", async () => {
    const user = await userFixture();
    mockSession(user.id);

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
      totalBrainPower: 15_000,
    });
  });

  it("returns null for zeroed placeholder progress", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await prisma.userProgress.create({ data: { totalBrainPower: BigInt(0), userId: user.id } });

    const result = await getBeltLevel();

    expect(result).toBeNull();
  });
});
