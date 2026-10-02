import { accessErrorCodes } from "@/lib/access-error-codes";
import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { requestPlusApproval } from "@zoonk/core/minors/guardian/request-plus-approval";
import { NextResponse } from "next/server";

/** A learner under 18 asks their guardians by email to approve Plus. */
async function createPlusApprovalRequest() {
  const result = await requestPlusApproval();

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "accountRequired") {
    return createErrorResponse({
      code: accessErrorCodes.accountRequired,
      message: "Create an account before asking a guardian",
      status: httpStatus.forbidden,
    });
  }

  if (result.status === "notNeeded") {
    return createErrorResponse({
      code: accessErrorCodes.plusApprovalNotNeeded,
      message: "Plus can already be purchased",
      status: httpStatus.conflict,
    });
  }

  if (result.status === "noGuardian") {
    return createErrorResponse({
      code: accessErrorCodes.noGuardian,
      message: "Invite a guardian first",
      status: httpStatus.unprocessableEntity,
    });
  }

  return new NextResponse(null, { status: 202 });
}

export const POST = withApiErrorBoundary(createPlusApprovalRequest);
