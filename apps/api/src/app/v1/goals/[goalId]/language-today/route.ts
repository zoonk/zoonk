import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getLanguageTodayView } from "@zoonk/core/view-models/language/today";
import { NextResponse } from "next/server";

async function getLanguageView(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/language-today">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getLanguageTodayView({ goalId: path.goalId });

  if (result.status !== "ready") {
    return languageError(result.status, "Goal not found");
  }

  return NextResponse.json(result.today);
}

export const GET = withApiErrorBoundary(getLanguageView);
