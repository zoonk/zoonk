import { getCourseChapterCompletion } from "@/data/progress/get-course-chapter-completion";
import { errors } from "@/lib/api-errors";
import { courseCompletionQuerySchema } from "@/lib/openapi/schemas/progress";
import { parseQueryParams } from "@/lib/query-params";
import { getSession } from "@zoonk/core/users/session/get";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQueryParams(searchParams, courseCompletionQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { courseId } = parsed.data;
  const session = await getSession(request.headers);
  const userId = session ? Number(session.user.id) : 0;
  const chapters = await getCourseChapterCompletion(userId, courseId);

  return NextResponse.json({ chapters });
}
