import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { startGoalGeneration } from "@/lib/goal-content";
import { planLinkPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { goalRefusedError, planErrorCodes } from "@/lib/plan-errors";
import { readBody, readPathParams } from "@/lib/request-input";
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
    readBody(request, planLinkStartInputSchema),
    readPathParams(context, planLinkPathParamsSchema),
  ]);

  const result = await startGoalFromPlanLink({ input: body, planId: path.planId });

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
