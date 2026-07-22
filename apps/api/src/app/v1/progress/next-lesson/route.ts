import { errors } from "@/lib/api-errors";
import { getRequestUserId } from "@/lib/get-request-user-id";
import { nextLessonQuerySchema } from "@/lib/openapi/schemas/progress";
import { readNextLessonTarget } from "@/lib/progress-reads";
import { parseQueryParams } from "@/lib/query-params";
import { type LessonScope } from "@zoonk/core/lessons/scope";
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
  const userId = await getRequestUserId(request.headers);
  const result = await readNextLessonTarget({ scope, userId });

  if (!result) {
    return NextResponse.json({ completed: false, hasStarted: false });
  }

  return NextResponse.json(result);
}
