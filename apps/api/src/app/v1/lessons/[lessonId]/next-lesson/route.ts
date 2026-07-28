import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getNextLessonAfter } from "@zoonk/core/lessons/next-in-course";
import { NextResponse } from "next/server";

/**
 * Returns the structural successor of the requested lesson rather than the
 * learner-progress target represented by the requested lesson itself.
 */
async function getLessonSuccessor(
  _request: Request,
  context: RouteContext<"/v1/lessons/[lessonId]/next-lesson">,
) {
  const parsed = parsePathParams({ params: await context.params, schema: lessonPathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await getNextLessonAfter({ lessonId: parsed.data.lessonId });

  if (result.status === "notFound") {
    return errors.notFound();
  }

  return NextResponse.json({ lesson: result.lesson });
}

export const GET = withApiErrorBoundary(getLessonSuccessor);
