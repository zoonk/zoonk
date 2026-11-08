import { withApiErrorBoundary } from "@/lib/api-handler";
import { readQueryParams } from "@/lib/request-input";
import { serializeToday } from "@/lib/study-session-serializers";
import { todayUnavailableError } from "@/lib/today-errors";
import { todayStudySessionInputSchema } from "@zoonk/core/sessions/contract";
import { getTodayView } from "@zoonk/core/view-models/today/get";
import { NextResponse } from "next/server";

async function getToday(request: Request) {
  const query = readQueryParams(request, todayStudySessionInputSchema);

  const result = await getTodayView(query);

  if (result.status !== "ready") {
    return todayUnavailableError(result);
  }

  return NextResponse.json(serializeToday(result.today));
}

export const GET = withApiErrorBoundary(getToday);
