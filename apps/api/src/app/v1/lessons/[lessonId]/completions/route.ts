import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { lessonCompletionRequestSchema } from "@/lib/openapi/schemas/lesson-resources";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { serializeBeltLevel } from "@/lib/progress-serializers";
import { completeLesson } from "@zoonk/core/player/commands/create-lesson-completion";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Validates and persists one authoritative lesson completion. The lesson ID is
 * owned by the resource path so clients cannot submit conflicting path/body IDs.
 */
async function createLessonCompletion(
  request: NextRequest,
  context: RouteContext<"/v1/lessons/[lessonId]/completions">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, lessonCompletionRequestSchema),
    context.params.then((params) => parsePathParams({ params, schema: lessonPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const completion = await completeLesson({ ...body.data, lessonId: path.data.lessonId });

  if (completion.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (completion.status === "notFound") {
    return errors.notFound();
  }

  if (completion.status === "subscriptionRequired") {
    return errors.paymentRequired();
  }

  if (completion.status === "invalid") {
    return errors.unprocessableEntity("Answers do not complete the lesson");
  }

  return NextResponse.json({
    ...completion.result,
    belt: serializeBeltLevel(completion.result.belt),
  });
}

export const POST = withApiErrorBoundary(createLessonCompletion);
