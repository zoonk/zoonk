import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toCatalogLesson } from "@/lib/catalog-responses";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getPublicLibraryLesson } from "@zoonk/core/library/lessons/public";
import { NextResponse } from "next/server";

async function getCatalogLesson(
  _request: Request,
  context: RouteContext<"/v1/catalog/lessons/[lessonId]">,
) {
  const parsed = await readPathParams(context, lessonPathParamsSchema);

  const lesson = await getPublicLibraryLesson({ lessonId: parsed.lessonId });

  if (!lesson) {
    return errors.notFound("Lesson not found");
  }

  return NextResponse.json(toCatalogLesson(lesson));
}

export const GET = withApiErrorBoundary(getCatalogLesson);
