import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseQueryParams } from "@/lib/query-params";
import { studySessionError } from "@/lib/study-session-errors";
import { serializeToday } from "@/lib/study-session-serializers";
import { noGoalError, planNotReadyError } from "@/lib/today-errors";
import { todayStudySessionInputSchema } from "@zoonk/core/sessions/contract";
import { getTodayView } from "@zoonk/core/view-models/today/get";
import { NextResponse } from "next/server";

/** Returns Today for a goal (the active goal by default), building the day's session the first time. */
async function getToday(request: Request) {
  const query = parseQueryParams(new URL(request.url).searchParams, todayStudySessionInputSchema);

  if (!query.success) {
    return errors.validation(query.error);
  }

  const result = await getTodayView(query.data);

  if (result.status === "noGoal") {
    return noGoalError(result.suggestedGoal);
  }

  if (result.status === "preparing") {
    return planNotReadyError(result.goal);
  }

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(serializeToday(result.today));
}

export const GET = withApiErrorBoundary(getToday);
