import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getLessonContent } from "@zoonk/core/player/queries/get-playable-lesson";
import { NextResponse } from "next/server";

/**
 * Returns one serialized player payload or a small generation outcome without
 * coupling clients to Main's page-level catalog composition.
 */
async function getLessonContentRoute(
  _request: Request,
  context: RouteContext<"/v1/lessons/[lessonId]/content">,
) {
  const parsed = parsePathParams({ params: await context.params, schema: lessonPathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await getLessonContent(parsed.data.lessonId);

  if (result.status === "unavailable") {
    return errors.notFound();
  }

  if (result.status === "subscriptionRequired") {
    return errors.paymentRequired();
  }

  if (result.status === "notGenerated") {
    const generationTarget = result.generationTarget
      ? { kind: result.generationTarget.kind, lessonId: result.generationTarget.lessonId }
      : null;

    return NextResponse.json({ generationTarget, status: result.status });
  }

  if (result.status === "reviewEmpty") {
    return NextResponse.json({
      generationLessonId: result.generationLessonId,
      status: result.status,
    });
  }

  return NextResponse.json(result);
}

export const GET = withApiErrorBoundary(getLessonContentRoute);
