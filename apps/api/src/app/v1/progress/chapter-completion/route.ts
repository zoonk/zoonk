import { getChapterLessonCompletion } from "@/data/progress/get-chapter-lesson-completion";
import { errors } from "@/lib/api-errors";
import { chapterCompletionQuerySchema } from "@/lib/openapi/schemas/progress";
import { parseQueryParams } from "@/lib/query-params";
import { getSession } from "@zoonk/core/users/session/get";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQueryParams(searchParams, chapterCompletionQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { chapterId } = parsed.data;
  const session = await getSession(request.headers);
  const userId = session ? Number(session.user.id) : 0;
  const lessons = await getChapterLessonCompletion(userId, chapterId);

  return NextResponse.json({ lessons });
}
