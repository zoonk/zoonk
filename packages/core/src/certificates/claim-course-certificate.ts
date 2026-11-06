import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getCertificatesCacheTag } from "../cache/tags";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { getSession } from "../users/get-session";
import { loadCertificatePlan, writeFinishedUnits } from "./_utils/award-course-certificate";
import { CERTIFICATE_FACTS_INCLUDE, toOwnedCertificateFacts } from "./_utils/certificate-facts";
import { type OwnedCertificateFacts } from "./certificate-contract";

export type ClaimCourseCertificateResult =
  | { certificates: OwnedCertificateFacts[]; status: "ready" }
  | { status: "notFinished" | "notFound" | "unauthorized" };

/**
 * Awards a learn or exam goal's finished level and plan certificates, and returns every one of its
 * plan's the learner holds. It's the one path for work that finished outside a lesson, challenge
 * or test-out: a plan rewrite, a lesson held back, an undo, or a plan finished before
 * certificates.
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

  const owned = await prisma.goal.findFirst({
    select: { id: true },
    where: { id: goalId, userId },
  });

  if (!owned) {
    return { status: "notFound" };
  }

  const claimed = await writeLearnerChange({ userId }, async (tx) => {
    const plan = await loadCertificatePlan(tx, { goalId });
    const result = plan ? await writeFinishedUnits(tx, { goal: plan.goal, plan }) : null;
    const keys = result?.units.map((unit) => unit.key) ?? [];
    const outcome = { keys, written: result?.written ?? 0 };

    return outcome.written > 0 ? outcome : unchanged(outcome);
  });

  if (claimed.written > 0) {
    revalidateCacheTags([getCertificatesCacheTag(userId)]);
  }

  const rows = await prisma.certificate.findMany({
    include: CERTIFICATE_FACTS_INCLUDE,
    where: { key: { in: claimed.keys }, kind: "course", userId },
  });

  if (rows.length === 0) {
    return { status: "notFinished" };
  }

  return {
    certificates: claimed.keys.flatMap((key) => {
      const row = rows.find((entry) => entry.key === key);
      return row ? toOwnedCertificateFacts(row) : [];
    }),
    status: "ready",
  };
}
