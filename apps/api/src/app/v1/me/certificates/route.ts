import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { withCertificateLinks } from "@/lib/certificate-links";
import { listCurrentUserCertificates } from "@zoonk/core/certificates/list";
import { NextResponse } from "next/server";

async function listCertificates() {
  const result = await listCurrentUserCertificates();

  if (result.status !== "ready") {
    return errors.unauthorized();
  }

  return NextResponse.json({
    certificates: result.certificates.map((certificate) => withCertificateLinks(certificate)),
  });
}

export const GET = withApiErrorBoundary(listCertificates);
