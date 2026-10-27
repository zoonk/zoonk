import { withApiErrorBoundary } from "@/lib/api-handler";
import { readQueryParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { serializeToday } from "@/lib/study-session-serializers";
import { noGoalError, planNotReadyError } from "@/lib/today-errors";
import { todayStudySessionInputSchema } from "@zoonk/core/sessions/contract";
import { getTodayViewFollowingDevice } from "@zoonk/core/view-models/today/get";
import { NextResponse } from "next/server";

/**
 * Reads a saved day or its ID-free preview. With `timeZone`, the goal follows the device first, as
 * Main's Today does with its own request. No study session is created or changed: the learner opens
 * the day with POST /v1/goals/{goalId}/study-sessions.
 */
async function getToday(request: Request) {
  const query = readQueryParams(request, todayStudySessionInputSchema);

  const result = await getTodayViewFollowingDevice(query);

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
