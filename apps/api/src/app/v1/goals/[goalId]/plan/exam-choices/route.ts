import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { planChangeInvalid } from "@/lib/plan-errors";
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
    parseBody(request, examChoiceInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: goalPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await chooseExamOption({ goalId: path.data.goalId, input: body.data });

  if (result.status === "invalid") {
    return planChangeInvalid(result.error);
  }

  if (result.status !== "applied") {
    return accessError(result.status);
  }

  // The picked option's topics come into the plan: their lessons start being written after the
  // response, as after any plan change.
  if (result.change) {
    await scheduleGoalPreparation(path.data.goalId);
  }

  return NextResponse.json({ change: result.change, status: result.status });
}

export const POST = withApiErrorBoundary(createExamChoice);
