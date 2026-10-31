import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { readQueryParams } from "@/lib/request-input";
import { reviewScheduleInputSchema } from "@zoonk/core/learner/contract";
import { getCurrentUserReviewSchedule } from "@zoonk/core/learner/review-schedule";
import { NextResponse } from "next/server";

const LOGICAL_DATE_LENGTH = 10;

async function getReviewSchedule(request: Request) {
  const query = readQueryParams(request, reviewScheduleInputSchema);

  const result = await getCurrentUserReviewSchedule(query);

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  const { cap, dueToday, forecast } = result.schedule;

  return NextResponse.json({
    cap,
    dueToday,
    forecast: forecast.map((day) => ({
      date: day.localDate.toISOString().slice(0, LOGICAL_DATE_LENGTH),
      reviews: day.reviews,
    })),
  });
}

export const GET = withApiErrorBoundary(getReviewSchedule);
