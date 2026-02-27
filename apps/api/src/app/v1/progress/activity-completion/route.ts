import { errors } from "@/lib/api-errors";
import { activityCompletionQuerySchema } from "@/lib/openapi/schemas/progress";
import { parseQueryParams } from "@/lib/query-params";
import { getLessonActivityCompletion } from "@zoonk/core/progress/lesson-activity-completion";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQueryParams(searchParams, activityCompletionQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { lessonId } = parsed.data;
  const completedActivityIds = await getLessonActivityCompletion({
    headers: request.headers,
    lessonId,
  });

  return NextResponse.json({ completedActivityIds });
}
