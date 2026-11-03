import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { warmUpPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getWarmUp } from "@zoonk/core/library/warm-ups/get";
import { NextResponse } from "next/server";

async function getWarmUpRoute(_request: Request, context: RouteContext<"/v1/warm-ups/[warmUpId]">) {
  const path = await readPathParams(context, warmUpPathParamsSchema);
  const result = await getWarmUp(path.warmUpId);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  return NextResponse.json(result.deck);
}

export const GET = withApiErrorBoundary(getWarmUpRoute);
