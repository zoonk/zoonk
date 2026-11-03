import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import {
  getCertificatesCacheTag,
  getUserProgressCacheTag,
  getUserSessionCacheTag,
} from "../cache/tags";
import { getSession } from "../users/get-session";
import { CERTIFICATE_FACTS_INCLUDE, toOwnedCertificateFacts } from "./_utils/certificate-facts";
import { type OwnedCertificateFacts } from "./certificate-contract";

export type CertificateListResult =
  | { certificates: OwnedCertificateFacts[]; status: "ready" }
  | { status: "unauthorized" };

/** Newest first. A rename expires the session tag, and progress writes are where certificates are earned. */
export async function listCurrentUserCertificates(): Promise<CertificateListResult> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  cacheTag(
    getCertificatesCacheTag(userId),
    getUserProgressCacheTag(userId),
    getUserSessionCacheTag(userId),
  );

  const rows = await prisma.certificate.findMany({
    include: CERTIFICATE_FACTS_INCLUDE,
    orderBy: { createdAt: "desc" },
    where: { userId },
  });

  return { certificates: rows.map((row) => toOwnedCertificateFacts(row)), status: "ready" };
}
