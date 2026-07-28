import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { serializeLearningActivity } from "@/lib/progress-serializers";
import { getCurrentUserActivity } from "@zoonk/core/progress/get-learning-activity";
import { NextResponse } from "next/server";

/**
 * Returns the authenticated learner's lifetime Activity totals and bounded
 * date-only completion calendar.
 */
async function getCurrentUserActivityRoute() {
  const resource = await getCurrentUserActivity();

  if (!resource) {
    return errors.unauthorized();
  }

  return NextResponse.json({ activity: serializeLearningActivity(resource.activity) });
}

export const GET = withApiErrorBoundary(getCurrentUserActivityRoute);
