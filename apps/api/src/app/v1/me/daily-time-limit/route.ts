import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { getDailyTimeLimitStatus } from "@zoonk/core/sessions/daily-time-limit";
import { NextResponse } from "next/server";

async function getCurrentUserDailyTimeLimit() {
  const status = await getDailyTimeLimitStatus();

  if (!status) {
    return errors.unauthorized();
  }

  return NextResponse.json(status);
}

export const GET = withApiErrorBoundary(getCurrentUserDailyTimeLimit);
