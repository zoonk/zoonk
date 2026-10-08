import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { guardianLinkPathParamsSchema } from "@/lib/openapi/schemas/guardians";
import { parsePathParams } from "@/lib/path-params";
import { approvePlusPurchase } from "@zoonk/core/minors/guardian/approve-plus";
import { NextResponse } from "next/server";

/** The guardian approves a Plus subscription for the learner. */
async function approvePlus(
  _request: Request,
  context: RouteContext<"/v1/me/guarded-learners/[linkId]/plus-approval">,
) {
  const parsed = parsePathParams({
    params: await context.params,
    schema: guardianLinkPathParamsSchema,
  });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await approvePlusPurchase(parsed.data);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound("Learner not found");
  }

  return new NextResponse(null, { status: 204 });
}

export const POST = withApiErrorBoundary(approvePlus);
