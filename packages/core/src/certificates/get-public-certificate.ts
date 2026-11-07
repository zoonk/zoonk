import "server-only";
import { prisma } from "@zoonk/db";
import { CERTIFICATE_FACTS_INCLUDE, toCertificateFacts } from "./_utils/certificate-facts";
import { type CertificateFacts, normalizeCertificateCode } from "./certificate-contract";

/**
 * What anyone with the link sees; no session needed. Not cached, so a rename or a deleted account
 * shows on the next read. Null for a code no certificate has, and for one that's locked, which is
 * only its owner's until they have Plus.
 */
export async function getPublicCertificate(code: string): Promise<CertificateFacts | null> {
  const normalized = normalizeCertificateCode(code);

  if (!normalized) {
    return null;
  }

  const row = await prisma.certificate.findUnique({
    include: CERTIFICATE_FACTS_INCLUDE,
    where: { code: normalized, issuedAt: { not: null }, kind: "course" },
  });

  return row ? toCertificateFacts(row) : null;
}
