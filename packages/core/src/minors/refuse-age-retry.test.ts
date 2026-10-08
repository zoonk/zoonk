import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { refuseAgeRetry } from "./refuse-age-retry";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

const TWO_DAYS_MS = 172_800_000;

describe(refuseAgeRetry, () => {
  it("needs a session", async () => {
    mockSession(null);
    await expect(refuseAgeRetry()).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("deletes an account made since the under-13 answer, with everything it made, and nobody else", async () => {
    const [guest, other] = await Promise.all([userFixture(), userFixture()]);

    const [goal, otherGoal] = await Promise.all([
      goalFixture({ userId: guest.id }),
      goalFixture({ userId: other.id }),
    ]);

    mockGuestSession(guest.id);

    await expect(refuseAgeRetry()).resolves.toStrictEqual({ status: "accountDeleted" });
    await expect(prisma.user.findUnique({ where: { id: guest.id } })).resolves.toBeNull();
    await expect(prisma.goal.findUnique({ where: { id: goal.id } })).resolves.toBeNull();
    await expect(prisma.goal.findUnique({ where: { id: otherGoal.id } })).resolves.not.toBeNull();
  });

  it("keeps an account that was already here before that answer", async () => {
    const learner = await userFixture();

    await prisma.user.update({
      data: { createdAt: new Date(Date.now() - TWO_DAYS_MS) },
      where: { id: learner.id },
    });

    mockSession(learner.id);

    await expect(refuseAgeRetry()).resolves.toStrictEqual({ status: "kept" });
    await expect(prisma.user.findUnique({ where: { id: learner.id } })).resolves.not.toBeNull();
  });
});
