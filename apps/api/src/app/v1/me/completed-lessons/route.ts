import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { completedLessonListQuerySchema } from "@/lib/openapi/schemas/completed-lessons";
import { createPaginatedResponse, decodeCursor } from "@/lib/pagination";
import { readQueryParams } from "@/lib/request-input";
import { listCurrentUserCompletedLessons } from "@zoonk/core/completed-lessons/list-current-user";
import { NextResponse } from "next/server";

async function listCompletedLessons(request: Request) {
  const { cursor, ...query } = readQueryParams(request, completedLessonListQuerySchema);
  const offset = cursor ? decodeCursor(cursor) : 0;

  if (offset === null) {
    return errors.badRequest("Invalid completed lessons cursor");
  }

  const result = await listCurrentUserCompletedLessons({ ...query, offset });

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(
    createPaginatedResponse({ hasMore: result.hasMore, items: result.lessons, offset }),
  );
}

export const GET = withApiErrorBoundary(listCompletedLessons);
