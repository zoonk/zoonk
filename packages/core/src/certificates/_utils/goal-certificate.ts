import "server-only";
import { type CertificateKind, prisma } from "@zoonk/db";
import { type CertificateFacts } from "../certificate-contract";
import { CERTIFICATE_FACTS_INCLUDE, toCertificateFacts } from "./certificate-facts";

/** A course's and a placement's certificate are keyed by their goal. */
export async function loadGoalCertificate({
  goalId,
  kind,
  userId,
}: {
  goalId: string;
  kind: Extract<CertificateKind, "course" | "placement">;
  userId: string;
}): Promise<CertificateFacts | null> {
  const row = await prisma.certificate.findUnique({
    include: CERTIFICATE_FACTS_INCLUDE,
    where: { userCertificate: { key: goalId, kind, userId } },
  });

  return row ? toCertificateFacts(row) : null;
}
