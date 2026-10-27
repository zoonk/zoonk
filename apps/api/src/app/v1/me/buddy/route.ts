import { withApiErrorBoundary } from "@/lib/api-handler";
import { readQueryParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { getBuddyStatus } from "@zoonk/core/milestones/buddy";
import { buddyStatusInputSchema } from "@zoonk/core/milestones/contract";
import { NextResponse } from "next/server";

/** Returns the buddy's page: Energy, stage, what it ate this week and the glasses. */
async function getBuddy(request: Request) {
  const query = readQueryParams(request, buddyStatusInputSchema);

  const result = await getBuddyStatus(query);

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(result.buddy);
}

export const GET = withApiErrorBoundary(getBuddy);
