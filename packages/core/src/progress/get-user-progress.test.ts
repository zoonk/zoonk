import { prisma } from "@zoonk/db";
import { userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getUserProgress } from "./get-user-progress";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

describe(getUserProgress, () => {
  it("does not query learner progress without an authenticated session", async () => {
    const findProgress = vi.spyOn(prisma.userProgress, "findUnique");
    mockSession(null);

    await expect(getUserProgress()).resolves.toBeNull();
    expect(findProgress).not.toHaveBeenCalled();
  });

  it("loads progress only for the authenticated learner", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await userProgressFixture({
      currentEnergy: 50,
      lastActiveAt: new Date("2026-07-12T00:00:00Z"),
      totalBrainPower: 15_000n,
      userId: user.id,
    });

    const progress = await getUserProgress();

    expect(progress?.userId).toBe(user.id);
  });
});
