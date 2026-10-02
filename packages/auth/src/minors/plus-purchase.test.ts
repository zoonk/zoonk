import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { getPlusPurchaseStatus } from "./plus-purchase";

const TEEN_BIRTH = { birthMonth: 1, birthYear: 2011 };

async function createLearner({
  birth,
  isAnonymous = false,
}: {
  birth?: { birthMonth: number; birthYear: number };
  isAnonymous?: boolean;
}) {
  const id = randomUUID();

  return prisma.user.create({
    data: {
      email: `plus-purchase-${id}@example.test`,
      id,
      isAnonymous,
      learningProfile: birth ? { create: birth } : undefined,
      name: "Plus purchase learner",
    },
  });
}

function createGuardianLink({
  plusApprovedAt,
  status,
  userId,
}: {
  plusApprovedAt: Date | null;
  status: "active" | "pending" | "revoked";
  userId: string;
}) {
  const key = randomUUID();

  return prisma.guardianLink.create({
    data: {
      guardianEmail: `guardian-${key}@example.test`,
      plusApprovedAt,
      status,
      tokenHash: `plus-purchase-${key}`,
      userId,
    },
  });
}

describe(getPlusPurchaseStatus, () => {
  it("lets adults and learners who never gave their age buy Plus", async () => {
    const [adult, unknown] = await Promise.all([
      createLearner({ birth: { birthMonth: 1, birthYear: 1990 } }),
      createLearner({}),
    ]);

    await expect(getPlusPurchaseStatus(adult.id)).resolves.toBe("allowed");
    await expect(getPlusPurchaseStatus(unknown.id)).resolves.toBe("allowed");
  });

  it("asks guests to create an account first", async () => {
    const guest = await createLearner({ isAnonymous: true });

    await expect(getPlusPurchaseStatus(guest.id)).resolves.toBe("guestNotAllowed");
  });

  it("needs an active guardian link that approved Plus for a learner under 18", async () => {
    const [teen, pendingTeen, approvedTeen] = await Promise.all([
      createLearner({ birth: TEEN_BIRTH }),
      createLearner({ birth: TEEN_BIRTH }),
      createLearner({ birth: TEEN_BIRTH }),
    ]);

    await Promise.all([
      createGuardianLink({ plusApprovedAt: null, status: "active", userId: teen.id }),
      createGuardianLink({ plusApprovedAt: new Date(), status: "pending", userId: pendingTeen.id }),
      createGuardianLink({ plusApprovedAt: new Date(), status: "active", userId: approvedTeen.id }),
    ]);

    await expect(getPlusPurchaseStatus(teen.id)).resolves.toBe("needsGuardianApproval");
    await expect(getPlusPurchaseStatus(pendingTeen.id)).resolves.toBe("needsGuardianApproval");
    await expect(getPlusPurchaseStatus(approvedTeen.id)).resolves.toBe("allowed");
  });
});
