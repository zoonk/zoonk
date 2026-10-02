import { withApiErrorBoundary } from "@/lib/api-handler";
import { studySessionError } from "@/lib/study-session-errors";
import { listCurrentUserMilestones } from "@zoonk/core/milestones/list";
import { NextResponse } from "next/server";

/** Returns the learner's milestones: glasses with progress, badges, belts and buddy stages. */
async function listMilestones() {
  const result = await listCurrentUserMilestones();

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(result.milestones);
}

export const GET = withApiErrorBoundary(listMilestones);
