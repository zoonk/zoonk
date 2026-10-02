import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { guardianLinkPathParamsSchema } from "@/lib/openapi/schemas/guardians";
import { parsePathParams } from "@/lib/path-params";
import { guardedLearnerUpdateSchema } from "@zoonk/core/minors/guardian/contract";
import { setGuardianDailyLimit } from "@zoonk/core/minors/guardian/set-daily-limit";
import { type NextRequest, NextResponse } from "next/server";

/** The guardian sets or removes the learner's daily study limit. */
async function updateLearner(
  request: NextRequest,
  context: RouteContext<"/v1/me/guarded-learners/[linkId]">,
) {
  const [params, body] = await Promise.all([
    context.params,
    parseBody(request, guardedLearnerUpdateSchema),
  ]);

  const parsedParams = parsePathParams({ params, schema: guardianLinkPathParamsSchema });

  if (!parsedParams.success) {
    return errors.validation(parsedParams.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await setGuardianDailyLimit({ ...body.data, ...parsedParams.data });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound("Learner not found");
  }

  return new NextResponse(null, { status: 204 });
}

export const PATCH = withApiErrorBoundary(updateLearner);
