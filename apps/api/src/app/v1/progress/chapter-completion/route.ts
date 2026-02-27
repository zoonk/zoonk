import { errors } from "@/lib/api-errors";
import { chapterCompletionQuerySchema } from "@/lib/openapi/schemas/progress";
import { parseQueryParams } from "@/lib/query-params";
import { getLessonProgress } from "@zoonk/core/progress/lessons";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQueryParams(searchParams, chapterCompletionQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { chapterId } = parsed.data;
  const lessons = await getLessonProgress({ chapterId, headers: request.headers });

  return NextResponse.json({ lessons });
}
