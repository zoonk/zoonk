import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { adaptPlanFromMock } from "@zoonk/core/exams/mocks/adapt-plan";
import { mockPlanOfferInputSchema } from "@zoonk/core/exams/mocks/contract";
import { type NextRequest, NextResponse } from "next/server";

/** The learner's yes to what a finished mock offered: skip what it showed they know, or focus. */
async function postPlanChange(
  request: NextRequest,
  context: RouteContext<"/v1/mocks/[blockId]/plan-changes">,
) {
  const [body, path] = await Promise.all([
    readBody(request, mockPlanOfferInputSchema),
    readPathParams(context, mockPathParamsSchema),
  ]);

  const result = await adaptPlanFromMock({ blockId: path.blockId, input: body });

  if (result.status === "applied") {
    return NextResponse.json({ ...result, reason: null });
  }

  if (result.status === "unchanged") {
    return NextResponse.json({ changeId: null, lessonsSkipped: 0, ...result });
  }

  return result.status === "unauthorized" ? errors.unauthorized() : errors.notFound();
}

export const POST = withApiErrorBoundary(postPlanChange);
