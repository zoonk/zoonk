import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { readQueryParams } from "@/lib/request-input";
import { memoryInsightQuerySchema } from "@zoonk/core/memory/contract";
import { getCurrentMemoryInsight } from "@zoonk/core/memory/insights/get-current";
import { NextResponse } from "next/server";

/** The insight Today shows, or null when there is none to answer. */
async function getCurrentInsight(request: Request) {
  const query = readQueryParams(request, memoryInsightQuerySchema);

  const result = await getCurrentMemoryInsight(query);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return NextResponse.json({ insight: result.insight });
}

export const GET = withApiErrorBoundary(getCurrentInsight);
