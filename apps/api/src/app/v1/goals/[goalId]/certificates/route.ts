import { accessError, createErrorResponse, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { withCertificateLinks } from "@/lib/certificate-links";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { claimCourseCertificate } from "@zoonk/core/certificates/claim";
import { NextResponse } from "next/server";

async function claimCertificate(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/certificates">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);
  const result = await claimCourseCertificate(path.goalId);

  if (result.status === "notFinished") {
    return createErrorResponse({
      code: "COURSE_NOT_FINISHED",
      message: "The course isn't finished, or this goal earns no course certificate",
      status: httpStatus.conflict,
    });
  }

  if (result.status !== "ready") {
    return accessError(result.status);
  }

  return NextResponse.json(withCertificateLinks(result.certificate));
}

export const POST = withApiErrorBoundary(claimCertificate);
