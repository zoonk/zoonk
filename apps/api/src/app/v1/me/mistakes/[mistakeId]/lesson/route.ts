import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { mistakePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { openMistakeLesson } from "@zoonk/core/mistakes/open-mistake-lesson";
import { NextResponse } from "next/server";

async function openLesson(
  _request: Request,
  context: RouteContext<"/v1/me/mistakes/[mistakeId]/lesson">,
) {
  const { mistakeId } = await readPathParams(context, mistakePathParamsSchema);
  const result = await openMistakeLesson(mistakeId);

  return result.status === "ready" ? NextResponse.json(result.lesson) : accessError(result.status);
}

export const POST = withApiErrorBoundary(openLesson);
