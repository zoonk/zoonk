import { withApiErrorBoundary } from "@/lib/api-handler";
import { studySessionError } from "@/lib/study-session-errors";
import { listCurrentUserMilestones } from "@zoonk/core/milestones/list";
import { serializeMilestone } from "@zoonk/core/sessions/completion-contract";
import { NextResponse } from "next/server";

async function listMilestones() {
  const result = await listCurrentUserMilestones();

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  const { ceremony, earned, glasses } = result.milestones;

  return NextResponse.json({
    ceremony: ceremony ? serializeMilestone(ceremony) : null,
    earned: earned.map((milestone) => serializeMilestone(milestone)),
    glasses,
  });
}

export const GET = withApiErrorBoundary(listMilestones);
