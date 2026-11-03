import "server-only";
import { prisma } from "@zoonk/db";
import { type CertificateFacts } from "../certificate-contract";
import { CERTIFICATE_FACTS_INCLUDE, toCertificateFacts } from "./certificate-facts";

/** Completion results carry these until the learner closes their moment, so a retry shows it again. */
export async function loadUnshownCertificates(userId: string): Promise<CertificateFacts[]> {
  const rows = await prisma.certificate.findMany({
    include: CERTIFICATE_FACTS_INCLUDE,
    orderBy: { createdAt: "asc" },
    where: { shownAt: null, userId },
  });

  return rows.map((row) => toCertificateFacts(row));
}
