import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { challengePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams, readQueryParams } from "@/lib/request-input";
import { changeMockSchedule, getMockSchedule } from "@zoonk/core/checkpoints/mock-schedule";
import { mockScheduleInputSchema } from "@zoonk/core/checkpoints/mock-schedule-contract";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { type NextRequest, NextResponse } from "next/server";

type Context = RouteContext<"/v1/challenges/[planItemId]/schedule">;

function refused(status: string) {
  if (status === "unauthorized") {
    return errors.unauthorized();
  }

  if (status === "notFound") {
    return errors.notFound();
  }

  return errors.conflict("The mock's schedule has changed or it has already started");
}
export const GET = withApiErrorBoundary(async (request: Request, context: Context) => {
  const path = await readPathParams(context, challengePathParamsSchema);
  const query = readQueryParams(request, studySessionTimeZoneInputSchema);
  const result = await getMockSchedule({ ...path, ...query });

  return result.status === "ready"
    ? NextResponse.json({ dates: result.dates })
    : refused(result.status);
});
export const POST = withApiErrorBoundary(async (request: NextRequest, context: Context) => {
  const path = await readPathParams(context, challengePathParamsSchema);
  const input = await readBody(request, mockScheduleInputSchema);
  const result = await changeMockSchedule({ ...path, input });

  return result.status === "changed"
    ? NextResponse.json({ changeId: result.changeId, planItemId: result.planItemId })
    : refused(result.status);
});
