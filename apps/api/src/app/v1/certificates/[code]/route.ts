import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { withCertificateLinks } from "@/lib/certificate-links";
import { certificatePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getPublicCertificate } from "@zoonk/core/certificates/public";
import { NextResponse } from "next/server";

async function readCertificate(
  _request: Request,
  context: RouteContext<"/v1/certificates/[code]">,
) {
  const path = await readPathParams(context, certificatePathParamsSchema);
  const certificate = await getPublicCertificate(path.code);

  if (!certificate) {
    return errors.notFound();
  }

  return NextResponse.json(withCertificateLinks(certificate), {
    headers: { "X-Robots-Tag": "noindex" },
  });
}

export const GET = withApiErrorBoundary(readCertificate);
