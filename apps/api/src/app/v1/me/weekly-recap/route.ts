import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseQueryParams } from "@/lib/query-params";
import { studySessionError } from "@/lib/study-session-errors";
import { serializeWeeklyRecap } from "@/lib/study-session-serializers";
import { weeklyRecapInputSchema } from "@zoonk/core/milestones/contract";
import { getWeeklyRecap } from "@zoonk/core/milestones/weekly-recap";
import { NextResponse } from "next/server";

/** Returns the week's logbook: the learner's numbers against their own last week and more. */
async function getRecap(request: Request) {
  const query = parseQueryParams(new URL(request.url).searchParams, weeklyRecapInputSchema);

  if (!query.success) {
    return errors.validation(query.error);
  }

  const result = await getWeeklyRecap(query.data);

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(serializeWeeklyRecap(result.recap));
}

export const GET = withApiErrorBoundary(getRecap);
