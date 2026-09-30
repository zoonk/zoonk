import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseQueryParams } from "@/lib/query-params";
import { memoryInsightQuerySchema } from "@zoonk/core/memory/contract";
import { getCurrentMemoryInsight } from "@zoonk/core/memory/insights/get-current";
import { NextResponse } from "next/server";

/** The insight Today shows, or null when there is none to answer. */
async function getCurrentInsight(request: Request) {
  const query = parseQueryParams(new URL(request.url).searchParams, memoryInsightQuerySchema);

  if (!query.success) {
    return errors.validation(query.error);
  }

  const result = await getCurrentMemoryInsight(query.data);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return NextResponse.json({ insight: result.insight });
}

export const GET = withApiErrorBoundary(getCurrentInsight);
