import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { planLinkPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getPlanLink } from "@zoonk/core/plans/link";
import { NextResponse } from "next/server";

/**
 * What a plan's link shows anyone: the subject and the plan's shape, never its owner. Signed-in
 * owners are told the link is theirs.
 */
async function readPlanLink(_request: Request, context: RouteContext<"/v1/plan-links/[planId]">) {
  const path = await readPathParams(context, planLinkPathParamsSchema);

  const result = await getPlanLink(path.planId);

  if (result.status !== "ready") {
    return errors.notFound();
  }

  return NextResponse.json(
    { outline: result.outline, owner: result.owner },
    { headers: { "X-Robots-Tag": "noindex" } },
  );
}

export const GET = withApiErrorBoundary(readPlanLink);
