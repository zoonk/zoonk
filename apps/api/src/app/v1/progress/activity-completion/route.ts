import { getLessonActivityCompletion } from "@/data/progress/get-lesson-activity-completion";
import { errors } from "@/lib/api-errors";
import { activityCompletionQuerySchema } from "@/lib/openapi/schemas/progress";
import { parseQueryParams } from "@/lib/query-params";
import { getSession } from "@zoonk/core/users/session/get";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQueryParams(searchParams, activityCompletionQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { lessonId } = parsed.data;
  const session = await getSession(request.headers);
  const userId = session ? Number(session.user.id) : 0;
  const completedActivityIds = await getLessonActivityCompletion(userId, lessonId);

  return NextResponse.json({ completedActivityIds });
}
