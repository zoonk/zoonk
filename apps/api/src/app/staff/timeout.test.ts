import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { signInStaff, staffRequest } from "./_test-utils/requests";
import { POST as countRecords } from "./records/count/route";

describe("staff query timeout", () => {
  it("returns 422 for a real statement timeout and accepts a retry after the lock is released", async () => {
    await signInStaff();
    const locked = Promise.withResolvers<null>();
    const release = Promise.withResolvers<null>();

    const holding = prisma.$transaction(
      async (client) => {
        await client.$executeRaw`LOCK TABLE rate_limits IN ACCESS EXCLUSIVE MODE`;
        locked.resolve(null);
        await release.promise;
      },
      { timeout: 10_000 },
    );

    holding.catch((error: unknown) => locked.reject(error));
    await locked.promise;

    try {
      const response = await countRecords(
        staffRequest({ body: { model: "RateLimit" }, path: "/staff/records/count" }),
      );

      expect(response.status).toBe(422);

      await expect(response.json()).resolves.toStrictEqual({
        error: { code: "QUERY_TIMEOUT", message: expect.any(String) },
      });
    } finally {
      release.resolve(null);
      await holding;
    }

    const retry = await countRecords(
      staffRequest({ body: { model: "RateLimit" }, path: "/staff/records/count" }),
    );

    expect(retry.status).toBe(200);
  });
});
