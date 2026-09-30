import { type GuardianLinkStatus, prisma } from "@zoonk/db";
import {
  guardianLinkFixture,
  learningProfileFixture,
} from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { approvePlusPurchase } from "./approve-plus-purchase";
import { listGuardedLearners } from "./list-guarded-learners";
import { setGuardianDailyLimit } from "./set-guardian-daily-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => {} })),
  headers: vi.fn(async () => new Headers()),
}));

const TEEN_BIRTH = { birthMonth: 1, birthYear: new Date().getUTCFullYear() - 15 };

/** A teen whose link to the guardian's email is in `status`, and the guardian's own account. */
async function linkedTeen({
  guardian = {},
  status,
}: {
  guardian?: { emailVerified?: boolean; isAnonymous?: boolean };
  status: GuardianLinkStatus;
}) {
  const [teen, account] = await Promise.all([userFixture(), userFixture()]);

  const [link] = await Promise.all([
    guardianLinkFixture({
      acceptedAt: status === "pending" ? null : new Date(),
      guardianEmail: account.email,
      status,
      userId: teen.id,
    }),
    learningProfileFixture({ ...TEEN_BIRTH, userId: teen.id }),
    prisma.user.update({ data: { emailVerified: true, ...guardian }, where: { id: account.id } }),
  ]);

  mockSession(account.id);
  return { link, teen };
}

describe("guardian link access", () => {
  it.each<GuardianLinkStatus>(["pending", "revoked"])(
    "gives a %s link's guardian no controls and no view of the learner",
    async (status) => {
      const { link } = await linkedTeen({ status });

      await expect(
        setGuardianDailyLimit({ dailyLimitMinutes: 30, linkId: link.id }),
      ).resolves.toStrictEqual({ status: "notFound" });

      await expect(approvePlusPurchase({ linkId: link.id })).resolves.toStrictEqual({
        status: "notFound",
      });

      await expect(listGuardedLearners()).resolves.toStrictEqual([]);

      const stored = await prisma.guardianLink.findUniqueOrThrow({ where: { id: link.id } });
      expect(stored).toMatchObject({ dailyLimitMinutes: null, plusApprovedAt: null });
    },
  );

  it("needs the invited email verified before the guardian acts", async () => {
    const { link } = await linkedTeen({ guardian: { emailVerified: false }, status: "active" });

    await expect(
      setGuardianDailyLimit({ dailyLimitMinutes: 30, linkId: link.id }),
    ).resolves.toStrictEqual({ status: "unauthorized" });

    await expect(listGuardedLearners()).resolves.toBeNull();
  });

  it("never lets a guest act as a guardian, even with the invited email", async () => {
    const { link } = await linkedTeen({ guardian: { isAnonymous: true }, status: "active" });

    await expect(approvePlusPurchase({ linkId: link.id })).resolves.toStrictEqual({
      status: "unauthorized",
    });

    await expect(listGuardedLearners()).resolves.toBeNull();
  });
});
