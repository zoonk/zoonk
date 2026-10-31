import { createErrorResponse, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { todayErrorCodes } from "@/lib/today-errors";
import { acknowledgeTodayPlanChange } from "@zoonk/core/plans/acknowledge-today-change";
import { acknowledgeTodayPlanChangeInputSchema } from "@zoonk/core/plans/today-change-contract";
import { type NextRequest, NextResponse } from "next/server";

async function acknowledgeChange(request: NextRequest) {
  const body = await readBody(request, acknowledgeTodayPlanChangeInputSchema);

  const result = await acknowledgeTodayPlanChange(body);

  if (result.status === "acknowledged") {
    return NextResponse.json(result);
  }

  if (result.status === "retryable") {
    return createErrorResponse({
      code: todayErrorCodes.planChangeReadChanged,
      message: "The plan changed since this notice was shown. Read Today again.",
      status: httpStatus.conflict,
    });
  }

  return studySessionError({ status: result.status });
}

export const POST = withApiErrorBoundary(acknowledgeChange);
