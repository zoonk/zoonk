import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { challengeMovePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { undoMockSchedule } from "@zoonk/core/checkpoints/mock-schedule";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";

export const DELETE = withApiErrorBoundary(
  async (
    request: Request,
    context: RouteContext<"/v1/challenges/[planItemId]/schedule/[changeId]">,
  ) => {
    const path = await readPathParams(context, challengeMovePathParamsSchema);
    const query = readQueryParams(request, studySessionTimeZoneInputSchema);
    const result = await undoMockSchedule({ ...path, ...query });

    if (result.status === "undone") {
      return new Response(null, { status: 204 });
    }

    if (result.status === "unauthorized") {
      return errors.unauthorized();
    }

    return result.status === "notFound"
      ? errors.notFound()
      : errors.conflict("The plan has changed since this mock was rescheduled");
  },
);
