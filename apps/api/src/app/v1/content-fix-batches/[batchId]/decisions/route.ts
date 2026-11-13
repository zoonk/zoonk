import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import {
  contentFixBatchDecisionRequestSchema,
  contentFixBatchPathParamsSchema,
} from "@/lib/openapi/schemas/content-fixes";
import { readBody, readPathParams } from "@/lib/request-input";
import { approveContentFixes, resumeContentFixes } from "@zoonk/core/staff/content-fixes/decide";
import { NextResponse } from "next/server";

async function createDecision(
  request: Request,
  context: RouteContext<"/v1/content-fix-batches/[batchId]/decisions">,
) {
  const [path, body] = await Promise.all([
    readPathParams(context, contentFixBatchPathParamsSchema),
    readBody(request, contentFixBatchDecisionRequestSchema),
  ]);

  const result =
    body.decision === "approve"
      ? await approveContentFixes({ assertion: body.assertion, batchId: path.batchId })
      : await resumeContentFixes(path.batchId);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "forbidden") {
    return errors.forbidden();
  }

  if (result.status === "notFound") {
    return errors.notFound("Content fix batch not found");
  }

  return NextResponse.json(result);
}

export const POST = withApiErrorBoundary(createDecision);
