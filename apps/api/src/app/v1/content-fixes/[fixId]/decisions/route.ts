import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import {
  contentFixDecisionRequestSchema,
  contentFixPathParamsSchema,
} from "@/lib/openapi/schemas/content-fixes";
import { readBody, readPathParams } from "@/lib/request-input";
import { rejectContentFix } from "@zoonk/core/staff/content-fixes/reject";
import { NextResponse } from "next/server";

async function createDecision(
  request: Request,
  context: RouteContext<"/v1/content-fixes/[fixId]/decisions">,
) {
  const [path] = await Promise.all([
    readPathParams(context, contentFixPathParamsSchema),
    readBody(request, contentFixDecisionRequestSchema),
  ]);

  const result = await rejectContentFix(path.fixId);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "forbidden") {
    return errors.forbidden();
  }

  if (result.status === "notFound") {
    return errors.notFound("Content fix not found");
  }

  return NextResponse.json(result);
}

export const POST = withApiErrorBoundary(createDecision);
