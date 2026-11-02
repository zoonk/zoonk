import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import * as nextCache from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { findReachedUsageLimit } from "./reached-usage-limit";

describe(findReachedUsageLimit, () => {
  it("uses the request's day when a daily goal cap resets during IO suspension", async () => {
    const user = await userFixture();

    await usageRecordsFixture({
      count: 10,
      createdAt: new Date("2026-10-13T12:00:00Z"),
      kind: "goal",
      userId: user.id,
    });

    const entered = Promise.withResolvers<null>();
    const request = Promise.withResolvers<null>();

    const boundary = vi.spyOn(nextCache, "io").mockImplementationOnce(async () => {
      entered.resolve(null);
      await request.promise;
    });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T23:59:59Z"));

    try {
      const limit = findReachedUsageLimit({ kind: "goal", tier: "plus", userId: user.id });
      await Promise.race([entered.promise, limit]);

      vi.setSystemTime(new Date("2026-10-14T00:00:01Z"));
      request.resolve(null);

      await expect(limit).resolves.toBeNull();
    } finally {
      request.resolve(null);
      boundary.mockRestore();
      vi.useRealTimers();
    }
  });
});
