import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toLessonResource } from "@/lib/catalog-responses";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getLessonById } from "@zoonk/core/lessons/get-by-id";
import { NextResponse } from "next/server";

/**
 * Returns the canonical structural metadata for one published lesson. Playable
 * steps remain a separate `/content` resource because they are larger and have
 * generation-specific outcomes.
 */
async function getLesson(_request: Request, context: RouteContext<"/v1/lessons/[lessonId]">) {
  const parsed = parsePathParams({ params: await context.params, schema: lessonPathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const lesson = await getLessonById({ lessonId: parsed.data.lessonId });

  if (!lesson) {
    return errors.notFound("Lesson not found");
  }

  return NextResponse.json(toLessonResource(lesson));
}

export const GET = withApiErrorBoundary(getLesson);
