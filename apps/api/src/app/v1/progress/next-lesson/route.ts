import { errors } from "@/lib/api-errors";
import { nextLessonQuerySchema } from "@/lib/openapi/schemas/progress";
import { parseQueryParams } from "@/lib/query-params";
import { type LessonScope } from "@zoonk/core/lessons/last-completed";
import { getNextLesson } from "@zoonk/core/progress/next-lesson";
import { NextResponse } from "next/server";

function getScope(params: {
  chapterId?: string;
  courseId?: string;
  lessonId?: string;
}): LessonScope {
  if (params.courseId) {
    return { courseId: params.courseId };
  }

  if (params.chapterId) {
    return { chapterId: params.chapterId };
  }

  return { lessonId: params.lessonId ?? "" };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQueryParams(searchParams, nextLessonQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { chapterId, courseId, lessonId } = parsed.data;
  const scope = getScope({ chapterId, courseId, lessonId });
  const result = await getNextLesson({ headers: request.headers, scope });

  if (!result) {
    return NextResponse.json({ completed: false, hasStarted: false });
  }

  return NextResponse.json(result);
}
