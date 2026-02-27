import { errors } from "@/lib/api-errors";
import { nextActivityQuerySchema } from "@/lib/openapi/schemas/progress";
import { parseQueryParams } from "@/lib/query-params";
import { type ActivityScope } from "@zoonk/core/activities/last-completed";
import { getNextActivity } from "@zoonk/core/progress/next-activity";
import { NextResponse } from "next/server";

function getScope(params: {
  chapterId?: number;
  courseId?: number;
  lessonId?: number;
}): ActivityScope {
  if (params.courseId) {
    return { courseId: params.courseId };
  }

  if (params.chapterId) {
    return { chapterId: params.chapterId };
  }

  return { lessonId: params.lessonId ?? 0 };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQueryParams(searchParams, nextActivityQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { chapterId, courseId, lessonId } = parsed.data;
  const scope = getScope({ chapterId, courseId, lessonId });
  const result = await getNextActivity({ headers: request.headers, scope });

  if (!result) {
    return NextResponse.json({ completed: false, hasStarted: false });
  }

  return NextResponse.json(result);
}
