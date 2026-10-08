import { accessErrorCodes } from "@/lib/access-error-codes";
import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import {
  type AcceptGuardianInviteResult,
  acceptGuardianInvite,
} from "@zoonk/core/minors/guardian/accept-invite";
import { guardianInviteAcceptanceSchema } from "@zoonk/core/minors/guardian/contract";
import { type NextRequest, NextResponse } from "next/server";

const acceptanceErrorResponses: Record<
  Exclude<AcceptGuardianInviteResult["status"], "accepted">,
  () => NextResponse
> = {
  emailNotVerified: () =>
    createErrorResponse({
      code: accessErrorCodes.emailNotVerified,
      message: "Verify your email before accepting",
      status: httpStatus.forbidden,
    }),
  expired: () =>
    createErrorResponse({
      code: accessErrorCodes.guardianInviteExpired,
      message: "This invite expired. Ask for a new one",
      status: httpStatus.unprocessableEntity,
    }),
  notFound: () => errors.notFound("Invite not found"),
  unauthorized: () => errors.unauthorized(),
  wrongAccount: () =>
    createErrorResponse({
      code: accessErrorCodes.guardianEmailMismatch,
      message: "Sign in with the email address the invite was sent to",
      status: httpStatus.forbidden,
    }),
};

/** The invited guardian accepts while signed in with the invited, verified email. */
async function acceptInvite(request: NextRequest) {
  const parsed = await parseBody(request, guardianInviteAcceptanceSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await acceptGuardianInvite(parsed.data);

  if (result.status !== "accepted") {
    return acceptanceErrorResponses[result.status]();
  }

  return NextResponse.json({ learnerName: result.learnerName, linkId: result.linkId });
}

export const POST = withApiErrorBoundary(acceptInvite);
