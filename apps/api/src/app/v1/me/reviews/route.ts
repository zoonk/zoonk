import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { parseQueryParams } from "@/lib/query-params";
import { reviewScheduleInputSchema } from "@zoonk/core/learner/contract";
import { getCurrentUserReviewSchedule } from "@zoonk/core/learner/review-schedule";
import { NextResponse } from "next/server";

const LOGICAL_DATE_LENGTH = 10;

/** Returns today's capped reviews and the coming week's review load. */
async function getReviewSchedule(request: Request) {
  const query = parseQueryParams(new URL(request.url).searchParams, reviewScheduleInputSchema);

  if (!query.success) {
    return errors.validation(query.error);
  }

  const result = await getCurrentUserReviewSchedule(query.data);

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
