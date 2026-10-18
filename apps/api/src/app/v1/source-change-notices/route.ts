import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { changeNoticesQuerySchema } from "@/lib/openapi/schemas/research-sources";
import { parseQueryParams } from "@/lib/query-params";
import { toChangeNoticeResource } from "@/lib/source-resources";
import { listGoalChangeNotices } from "@zoonk/core/library/sources/notices";
import { type NextRequest, NextResponse } from "next/server";

/** The recent one-line notices about changes to what a goal studies, for Today. */
async function getChangeNotices(request: NextRequest) {
  const parsed = parseQueryParams(request.nextUrl.searchParams, changeNoticesQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await listGoalChangeNotices({ goalId: parsed.data.goalId });

  if (result.status !== "ready") {
    return accessError(result.status, "Goal not found");
  }

  return NextResponse.json({
    notices: result.notices.map((notice) => toChangeNoticeResource(notice)),
  });
}

export const GET = withApiErrorBoundary(getChangeNotices);
