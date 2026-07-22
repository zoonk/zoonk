import { errors } from "@/lib/api-errors";
import { getRequestUserId } from "@/lib/get-request-user-id";
import { chapterCompletionQuerySchema } from "@/lib/openapi/schemas/progress";
import { readChapterCompletion } from "@/lib/progress-reads";
import { parseQueryParams } from "@/lib/query-params";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQueryParams(searchParams, chapterCompletionQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { chapterId } = parsed.data;
  const userId = await getRequestUserId(request.headers);
  const lessons = await readChapterCompletion({ chapterId, userId });

  return NextResponse.json({ lessons });
}
