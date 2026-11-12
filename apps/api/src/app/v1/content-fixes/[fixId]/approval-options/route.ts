import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { contentFixPathParamsSchema } from "@/lib/openapi/schemas/content-fixes";
import { readPathParams } from "@/lib/request-input";
import { getContentFixApprovalOptions } from "@zoonk/core/staff/content-fixes/decide";
import { NextResponse } from "next/server";

async function createApprovalOptions(
  _request: Request,
  context: RouteContext<"/v1/content-fixes/[fixId]/approval-options">,
) {
  const path = await readPathParams(context, contentFixPathParamsSchema);
  const result = await getContentFixApprovalOptions(path.fixId);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "forbidden") {
    return errors.forbidden();
  }

  if (result.status === "notFound") {
    return errors.notFound("Content fix not found");
  }

  if (result.status === "decided") {
    return NextResponse.json({ fix: result.fix, status: result.status });
  }

  return NextResponse.json(result);
}

export const POST = withApiErrorBoundary(createApprovalOptions);
