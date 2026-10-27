import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { runEndedError } from "@/lib/lesson-player-errors";
import { stepPathParamsSchema } from "@/lib/openapi/schemas/steps";
import { readBody, readPathParams } from "@/lib/request-input";
import { checkLessonStep } from "@zoonk/core/lesson-player/check";
import { lessonStepCheckInputSchema } from "@zoonk/core/lesson-player/contract";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Grades one answer to a lesson screen and records it in the learner's memory and mistakes
 * notebook, as part of an open run of the screen's lesson.
 */
async function createStepCheck(
  request: NextRequest,
  context: RouteContext<"/v1/steps/[stepId]/checks">,
) {
  const [body, path] = await Promise.all([
    readBody(request, lessonStepCheckInputSchema),
    readPathParams(context, stepPathParamsSchema),
  ]);

  const outcome = await checkLessonStep({ input: body, stepId: path.stepId });

  switch (outcome.status) {
    case "unauthorized":
      return errors.unauthorized();
    case "notFound":
      return errors.notFound();
    case "invalid":
      return errors.unprocessableEntity("This answer doesn't fit this screen");
    case "runEnded":
      return runEndedError();
    case "checked":
      return NextResponse.json(outcome.result);
    default:
      return outcome satisfies never;
  }
}

export const POST = withApiErrorBoundary(createStepCheck);
