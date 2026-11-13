import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import {
  contentFixApprovalOptionsRequestSchema,
  contentFixBatchPathParamsSchema,
} from "@/lib/openapi/schemas/content-fixes";
import { readBody, readPathParams } from "@/lib/request-input";
import { getContentFixApprovalOptions } from "@zoonk/core/staff/content-fixes/decide";
import { NextResponse } from "next/server";

async function createApprovalOptions(
  request: Request,
  context: RouteContext<"/v1/content-fix-batches/[batchId]/approval-options">,
) {
  const [path, body] = await Promise.all([
    readPathParams(context, contentFixBatchPathParamsSchema),
    readBody(request, contentFixApprovalOptionsRequestSchema),
  ]);

  const result = await getContentFixApprovalOptions({ batchId: path.batchId, fixIds: body.fixIds });

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

export const POST = withApiErrorBoundary(createApprovalOptions);
