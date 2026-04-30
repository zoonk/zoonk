import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, it } from "vitest";
import { getTotalBrainPower } from "./get-total-brain-power";

describe("unauthenticated users", () => {
  it("returns 0", async () => {
    const result = await getTotalBrainPower(new Headers());
    expect(result).toBe(0);
  });
});

describe("authenticated users", () => {
  let headers: Headers;
  let userId: string;

  beforeAll(async () => {
    const user = await userFixture();
    headers = await signInAs(user.email, user.password);
    userId = user.id;
  });

  it("returns 0 when user has no progress record", async () => {
    const result = await getTotalBrainPower(headers);
    expect(result).toBe(0);
  });

  it("returns total brain power from progress record", async () => {
    await prisma.userProgress.create({ data: { totalBrainPower: BigInt(2500), userId } });

    const result = await getTotalBrainPower(headers);
    expect(result).toBe(2500);
  });
});
