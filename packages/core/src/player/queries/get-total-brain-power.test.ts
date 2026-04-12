import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { getTotalBrainPower } from "./get-total-brain-power";

describe("unauthenticated users", () => {
  test("returns 0", async () => {
    const result = await getTotalBrainPower(new Headers());
    expect(result).toBe(0);
  });
});

describe("authenticated users", () => {
  let headers: Headers;
  let userId: number;

  beforeAll(async () => {
    const user = await userFixture();
    headers = await signInAs(user.email, user.password);
    userId = Number(user.id);
  });

  test("returns 0 when user has no progress record", async () => {
    const result = await getTotalBrainPower(headers);
    expect(result).toBe(0);
  });

  test("returns total brain power from progress record", async () => {
    await prisma.userProgress.create({
      data: {
        totalBrainPower: BigInt(2500),
        userId,
      },
    });

    const result = await getTotalBrainPower(headers);
    expect(result).toBe(2500);
  });
});
