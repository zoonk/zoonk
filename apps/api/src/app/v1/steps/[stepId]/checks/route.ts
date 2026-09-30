import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { runEndedError, tooManyAnswersError } from "@/lib/lesson-player-errors";
import { stepPathParamsSchema } from "@/lib/openapi/schemas/step-variants";
import { parsePathParams } from "@/lib/path-params";
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
    parseBody(request, lessonStepCheckInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: stepPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const outcome = await checkLessonStep({ input: body.data, stepId: path.data.stepId });

  switch (outcome.status) {
    case "unauthorized":
      return errors.unauthorized();
    case "notFound":
      return errors.notFound();
    case "invalid":
      return errors.unprocessableEntity("This answer doesn't fit this screen");
    case "runEnded":
      return runEndedError();
    case "tooManyAnswers":
      return tooManyAnswersError();
    case "checked":
      return NextResponse.json(outcome.result);
    default:
      return outcome satisfies never;
  }
}

export const POST = withApiErrorBoundary(createStepCheck);
