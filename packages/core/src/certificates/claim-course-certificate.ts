import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getCertificatesCacheTag } from "../cache/tags";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { getSession } from "../users/get-session";
import { awardCourseCertificate } from "./_utils/award-course-certificate";
import { CERTIFICATE_FACTS_INCLUDE, toOwnedCertificateFacts } from "./_utils/certificate-facts";
import { type OwnedCertificateFacts } from "./certificate-contract";

export type ClaimCourseCertificateResult =
  | { certificate: OwnedCertificateFacts; status: "ready" }
  | { status: "notFinished" | "notFound" | "unauthorized" };

/**
 * Awards a finished learn or exam goal's course certificate, or returns it when it exists. It's the
 * one path for a course that finished outside a lesson, challenge or test-out: a plan rewrite, a
 * lesson held back, an undo, or a plan finished before certificates.
 */
export async function claimCourseCertificate(
  goalId: string,
): Promise<ClaimCourseCertificateResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(goalId)) {
    return { status: "notFound" };
  }

  const userId = session.user.id;

  const goal = await prisma.goal.findFirst({
    select: { plan: { select: { id: true } } },
    where: { id: goalId, userId },
  });

  if (!goal) {
    return { status: "notFound" };
  }

  const planId = goal.plan?.id;

  const awarded = planId
    ? await writeLearnerChange({ userId }, async (tx) => {
        const result = await awardCourseCertificate(tx, planId);
        return result?.created ? result : unchanged(result);
      })
    : null;

  if (!awarded) {
    return { status: "notFinished" };
  }

  if (awarded.created) {
    revalidateCacheTags([getCertificatesCacheTag(userId)]);
  }

  const row = await prisma.certificate.findUniqueOrThrow({
    include: CERTIFICATE_FACTS_INCLUDE,
    where: { id: awarded.certificate.id },
  });

  return { certificate: toOwnedCertificateFacts(row), status: "ready" };
}
