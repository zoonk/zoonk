import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { startGoalGeneration } from "@/lib/goal-content";
import { planLinkPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { goalRefusedError, planErrorCodes } from "@/lib/plan-errors";
import { planLinkStartInputSchema } from "@zoonk/core/plans/link-contract";
import { startGoalFromPlanLink } from "@zoonk/core/plans/start-from-link";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type NextRequest, NextResponse } from "next/server";

const CREATED = 201;

/** A run that couldn't start is logged; the client can start it again for that goal. */
async function startLinkedGoalGeneration(goal: Parameters<typeof startGoalGeneration>[0]["goal"]) {
  const { error } = await safeAsync(() => startGoalGeneration({ goal }));

  if (error) {
    logError("[planLinkGoals] The goal's run didn't start:", error);
  }
}

/**
 * Starts the viewer's own goal from a plan link: the same subject and plan structure at their own
 * time, and its run writing ahead what the plan needs (placement's questions, the first lessons).
 * A run that couldn't start never undoes the goal: POST /goals/{goalId}/generations starts it.
 * The owner gets their existing goal back.
 */
async function startFromLink(
  request: NextRequest,
  context: RouteContext<"/v1/plan-links/[planId]/goals">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, planLinkStartInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: planLinkPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await startGoalFromPlanLink({ input: body.data, planId: path.data.planId });

  switch (result.status) {
    case "created":
      await startLinkedGoalGeneration(result.goal);
      return NextResponse.json(result.goal, { status: CREATED });
    case "owner":
      return NextResponse.json(result.goal);
    case "refused":
      return result.refusals[0] ? goalRefusedError(result.refusals[0].decision) : errors.internal();
    case "titleRequired":
      return createErrorResponse({
        code: planErrorCodes.planLinkTitleRequired,
        message: "This plan has no public subject; send a title for the new goal",
        status: httpStatus.unprocessableEntity,
      });
    case "unauthorized":
      return errors.unauthorized();
    case "invalidReference":
    case "notFound":
      return errors.notFound();
    default:
      return result satisfies never;
  }
}

export const POST = withApiErrorBoundary(startFromLink);
