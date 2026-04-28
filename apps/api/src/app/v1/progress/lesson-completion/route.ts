import { errors } from "@/lib/api-errors";
import { lessonCompletionQuerySchema } from "@/lib/openapi/schemas/progress";
import { parseQueryParams } from "@/lib/query-params";
import { getLessonProgress } from "@zoonk/core/progress/lessons";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQueryParams(searchParams, lessonCompletionQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { lessonId } = parsed.data;
  const completedLessonIds = await getLessonProgress({
    headers: request.headers,
    lessonId,
  });

  return NextResponse.json({ completedLessonIds });
}
