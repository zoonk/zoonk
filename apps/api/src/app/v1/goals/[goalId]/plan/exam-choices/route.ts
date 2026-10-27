import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { planChangeInvalid } from "@/lib/plan-errors";
import { readBody, readPathParams } from "@/lib/request-input";
import { scheduleGoalPreparation } from "@/lib/session-preparation";
import { chooseExamOption } from "@zoonk/core/exams/choices/choose";
import { examChoiceInputSchema } from "@zoonk/core/exams/choices/contract";
import { type NextRequest, NextResponse } from "next/server";

/** The option the learner takes of one of their exam's choices, such as ENEM's foreign language. */
async function createExamChoice(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/plan/exam-choices">,
) {
  const [body, path] = await Promise.all([
    readBody(request, examChoiceInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await chooseExamOption({ goalId: path.goalId, input: body });

  if (result.status === "invalid") {
    return planChangeInvalid(result);
  }

  if (result.status !== "applied") {
    return accessError(result.status);
  }

  // The picked option's topics come into the plan: their lessons start being written after the
  // response, as after any plan change.
  if (result.change) {
    await scheduleGoalPreparation(path.goalId);
  }

  return NextResponse.json({ change: result.change, status: result.status });
}

export const POST = withApiErrorBoundary(createExamChoice);
