import { accessErrorCodes } from "@/lib/access-error-codes";
import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { serializeGuardianLink } from "@/lib/guardian-serializers";
import { guardianInviteSchema } from "@zoonk/core/minors/guardian/contract";
import { type InviteGuardianResult, inviteGuardian } from "@zoonk/core/minors/guardian/invite";
import { listGuardianLinks } from "@zoonk/core/minors/guardian/list-links";
import { type NextRequest, NextResponse } from "next/server";

/** The learner's guardians and pending invites. */
async function listLinks() {
  const links = await listGuardianLinks();

  if (!links) {
    return errors.unauthorized();
  }

  return NextResponse.json({ links: links.map((link) => serializeGuardianLink(link)) });
}

const inviteErrorResponses: Record<
  Exclude<InviteGuardianResult["status"], "invited">,
  () => NextResponse
> = {
  accountRequired: () =>
    createErrorResponse({
      code: accessErrorCodes.accountRequired,
      message: "Create an account before inviting a guardian",
      status: httpStatus.forbidden,
    }),
  invalidEmail: () => errors.badRequest("Invite someone else as your guardian"),
  limitReached: () =>
    createErrorResponse({
      code: accessErrorCodes.guardianInviteLimitReached,
      message: "Too many invites today. Try again tomorrow",
      status: httpStatus.tooManyRequests,
    }),
  notMinor: () =>
    createErrorResponse({
      code: accessErrorCodes.guardianNotAvailable,
      message: "Guardians are for learners under 18 who gave their age",
      status: httpStatus.forbidden,
    }),
  unauthorized: () => errors.unauthorized(),
};

/** A learner under 18 invites a guardian by email; a new invite replaces a pending one. */
async function createLink(request: NextRequest) {
  const parsed = await parseBody(request, guardianInviteSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await inviteGuardian(parsed.data);

  if (result.status !== "invited") {
    return inviteErrorResponses[result.status]();
  }

  return NextResponse.json({ link: serializeGuardianLink(result.link) }, { status: 201 });
}

export const GET = withApiErrorBoundary(listLinks);
export const POST = withApiErrorBoundary(createLink);
