import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import * as nextCache from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { mockGuestSession } from "../../_test-utils/mock-session";
import { loadExamPrepAccess } from "./plus-only-lessons";

describe(loadExamPrepAccess, () => {
  it("ends a guest's free exam week on the request's day after IO suspension", async () => {
    const user = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });
    mockGuestSession(user.id);

    const goal = await goalFixture({
      createdAt: new Date("2026-10-07T12:00:00Z"),
      kind: "exam",
      timezone: "UTC",
      userId: user.id,
    });

    const entered = Promise.withResolvers<null>();
    const request = Promise.withResolvers<null>();
    /** The real DB stays in use; only Next's request boundary has no request in Vitest. */
    const boundary = vi.spyOn(nextCache, "io").mockImplementationOnce(async () => {
      entered.resolve(null);
      await request.promise;
    });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T23:59:59Z"));

    try {
      const access = loadExamPrepAccess({ goal });
      await Promise.race([entered.promise, access]);

      vi.setSystemTime(new Date("2026-10-14T00:00:01Z"));
      request.resolve(null);

      await expect(access).resolves.toMatchObject({ trialEnded: true });
    } finally {
      request.resolve(null);
      boundary.mockRestore();
      vi.useRealTimers();
    }
  });
});
