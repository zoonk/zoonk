import { errors } from "@/lib/api-errors";
import { activityCompletionQuerySchema } from "@/lib/openapi/schemas/progress";
import { parseQueryParams } from "@/lib/query-params";
import { getActivityProgress } from "@zoonk/core/progress/activities";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQueryParams(searchParams, activityCompletionQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { lessonId } = parsed.data;
  const completedActivityIds = await getActivityProgress({
    headers: request.headers,
    lessonId,
  });

  return NextResponse.json({ completedActivityIds });
}
