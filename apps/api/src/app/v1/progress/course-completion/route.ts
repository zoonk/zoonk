import { errors } from "@/lib/api-errors";
import { courseCompletionQuerySchema } from "@/lib/openapi/schemas/progress";
import { parseQueryParams } from "@/lib/query-params";
import { getChapterProgress } from "@zoonk/core/progress/chapters";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQueryParams(searchParams, courseCompletionQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { courseId } = parsed.data;
  const chapters = await getChapterProgress({ courseId, headers: request.headers });

  return NextResponse.json({ chapters });
}
