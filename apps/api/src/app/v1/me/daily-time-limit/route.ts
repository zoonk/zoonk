import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { getDailyTimeLimitStatus } from "@zoonk/core/minors/daily-time-limit";
import { NextResponse } from "next/server";

/** How much of today's study time is left under the limits the learner's guardians set. */
async function getCurrentUserDailyTimeLimit() {
  const status = await getDailyTimeLimitStatus();

  if (!status) {
    return errors.unauthorized();
  }

  return NextResponse.json(status);
}

export const GET = withApiErrorBoundary(getCurrentUserDailyTimeLimit);
