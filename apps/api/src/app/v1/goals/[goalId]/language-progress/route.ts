import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getLanguageProgressView } from "@zoonk/core/view-models/language/progress";
import { NextResponse } from "next/server";

async function getLanguageView(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/language-progress">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getLanguageProgressView({ goalId: path.goalId });

  if (result.status !== "ready") {
    return languageError(result.status, "Goal not found");
  }

  return NextResponse.json(result.progress);
}

export const GET = withApiErrorBoundary(getLanguageView);
