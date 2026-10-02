import { prisma } from "@zoonk/db";
import { getAgeGroup } from "@zoonk/utils/age";

export type PlusPurchaseStatus = "allowed" | "guestNotAllowed" | "needsGuardianApproval";

/**
 * Decides whether a learner can buy Plus. Guests need an account first, and learners under 18 need a
 * guardian who approved it through an active guardian link. Learners who never gave their age are
 * treated as adults, as they were before the age question existed.
 */
export async function getPlusPurchaseStatus(userId: string): Promise<PlusPurchaseStatus> {
  const user = await prisma.user.findUniqueOrThrow({
    include: {
      guardianLinks: {
        select: { id: true },
        take: 1,
        where: { plusApprovedAt: { not: null }, status: "active" },
      },
      learningProfile: { select: { birthMonth: true, birthYear: true } },
    },
    where: { id: userId },
  });

  if (user.isAnonymous) {
    return "guestNotAllowed";
  }

  const ageGroup = getAgeGroup({
    birthMonth: user.learningProfile?.birthMonth ?? null,
    birthYear: user.learningProfile?.birthYear ?? null,
  });

  if (ageGroup === "adult" || ageGroup === "unknown") {
    return "allowed";
  }

  return user.guardianLinks.length > 0 ? "allowed" : "needsGuardianApproval";
}
