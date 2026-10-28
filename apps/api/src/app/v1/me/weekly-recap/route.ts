import { withApiErrorBoundary } from "@/lib/api-handler";
import { readQueryParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { serializeWeeklyRecap } from "@/lib/study-session-serializers";
import { weeklyRecapInputSchema } from "@zoonk/core/milestones/contract";
import { getWeeklyRecap } from "@zoonk/core/milestones/weekly-recap";
import { NextResponse } from "next/server";

async function getRecap(request: Request) {
  const query = readQueryParams(request, weeklyRecapInputSchema);

  const result = await getWeeklyRecap(query);

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(serializeWeeklyRecap(result.recap));
}

export const GET = withApiErrorBoundary(getRecap);
