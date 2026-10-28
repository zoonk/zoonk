import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getLessonFit } from "@zoonk/core/view-models/onboarding/get-lesson-fit";
import { NextResponse } from "next/server";

async function getLibraryLessonFit(
  _request: Request,
  context: RouteContext<"/v1/library/lessons/[lessonId]/fit">,
) {
  const path = await readPathParams(context, lessonPathParamsSchema);
  const fit = await getLessonFit({ lessonId: path.lessonId });

  return fit ? NextResponse.json(fit) : errors.notFound();
}

export const GET = withApiErrorBoundary(getLibraryLessonFit);
