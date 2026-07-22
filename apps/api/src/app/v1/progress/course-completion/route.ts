import { errors } from "@/lib/api-errors";
import { getRequestUserId } from "@/lib/get-request-user-id";
import { courseCompletionQuerySchema } from "@/lib/openapi/schemas/progress";
import { readCourseCompletion } from "@/lib/progress-reads";
import { parseQueryParams } from "@/lib/query-params";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQueryParams(searchParams, courseCompletionQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { courseId } = parsed.data;
  const userId = await getRequestUserId(request.headers);
  const chapters = await readCourseCompletion({ courseId, userId });

  return NextResponse.json({ chapters });
}
