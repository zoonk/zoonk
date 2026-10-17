import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseQueryParams } from "@/lib/query-params";
import { studySessionError } from "@/lib/study-session-errors";
import { getBuddyStatus } from "@zoonk/core/milestones/buddy";
import { buddyStatusInputSchema } from "@zoonk/core/milestones/contract";
import { NextResponse } from "next/server";

/** Returns the buddy's page: Energy, stage, what it ate this week and the glasses. */
async function getBuddy(request: Request) {
  const query = parseQueryParams(new URL(request.url).searchParams, buddyStatusInputSchema);

  if (!query.success) {
    return errors.validation(query.error);
  }

  const result = await getBuddyStatus(query.data);

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(result.buddy);
}

export const GET = withApiErrorBoundary(getBuddy);
