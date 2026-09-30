import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { guardianLinkPathParamsSchema } from "@/lib/openapi/schemas/guardians";
import { parsePathParams } from "@/lib/path-params";
import { revokeGuardianLink } from "@zoonk/core/minors/guardian/revoke-link";
import { NextResponse } from "next/server";

/** The learner cancels a pending invite, or the guardian ends an active link. */
async function revokeLink(
  _request: Request,
  context: RouteContext<"/v1/me/guardian-links/[linkId]">,
) {
  const parsed = parsePathParams({
    params: await context.params,
    schema: guardianLinkPathParamsSchema,
  });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await revokeGuardianLink(parsed.data);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound("Guardian link not found");
  }

  return new NextResponse(null, { status: 204 });
}

export const DELETE = withApiErrorBoundary(revokeLink);
