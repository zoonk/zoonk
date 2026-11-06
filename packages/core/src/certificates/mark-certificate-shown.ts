import "server-only";
import { prisma } from "@zoonk/db";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { getSession } from "../users/get-session";
import { normalizeCertificateCode } from "./certificate-contract";

export type CertificateShownResult = { status: "notFound" | "ready" | "unauthorized" };

/** Keeps the first time. Expires no cache tag: rerendering would close the moment on screen. */
export async function markCertificateShown(code: string): Promise<CertificateShownResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const normalized = normalizeCertificateCode(code);

  if (!normalized) {
    return { status: "notFound" };
  }

  const userId = session.user.id;

  const found = await prisma.$transaction(async (tx) => {
    await markLearnerChanged(tx, { userId });

    await tx.certificate.updateMany({
      data: { shownAt: new Date() },
      where: { code: normalized, shownAt: null, userId },
    });

    return tx.certificate.count({ where: { code: normalized, userId } });
  });

  return { status: found > 0 ? "ready" : "notFound" };
}
