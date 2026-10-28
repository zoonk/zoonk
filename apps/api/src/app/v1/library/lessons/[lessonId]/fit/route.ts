import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getLessonFit } from "@zoonk/core/view-models/onboarding/get-lesson-fit";
import { NextResponse } from "next/server";

/**
 * Where a public lesson fits, for the end of a guest's lesson: its chapter and the course "Build
 * my plan" starts. Public content, the same for everyone.
 */
async function getLibraryLessonFit(
  _request: Request,
  context: RouteContext<"/v1/library/lessons/[lessonId]/fit">,
) {
  const path = await readPathParams(context, lessonPathParamsSchema);
  const fit = await getLessonFit({ lessonId: path.lessonId });

  return fit ? NextResponse.json(fit) : errors.notFound();
}

export const GET = withApiErrorBoundary(getLibraryLessonFit);
