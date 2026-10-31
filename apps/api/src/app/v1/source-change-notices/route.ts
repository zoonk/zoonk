import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { changeNoticesQuerySchema } from "@/lib/openapi/schemas/research-sources";
import { readQueryParams } from "@/lib/request-input";
import { toChangeNoticeResource } from "@/lib/source-resources";
import { listGoalChangeNotices } from "@zoonk/core/library/sources/notices";
import { type NextRequest, NextResponse } from "next/server";

async function getChangeNotices(request: NextRequest) {
  const parsed = readQueryParams(request, changeNoticesQuerySchema);

  const result = await listGoalChangeNotices({ goalId: parsed.goalId });

  if (result.status !== "ready") {
    return accessError(result.status, "Goal not found");
  }

  return NextResponse.json({
    notices: result.notices.map((notice) => toChangeNoticeResource(notice)),
  });
}

export const GET = withApiErrorBoundary(getChangeNotices);
