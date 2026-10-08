import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getLanguageTodayView } from "@zoonk/core/view-models/language/today";
import { NextResponse } from "next/server";

/** Returns what Today adds for a language goal: the level across skills, a noticed pattern and words to say again. */
async function getLanguageView(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/language-today">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getLanguageTodayView({ goalId: path.data.goalId });

  if (result.status !== "ready") {
    return languageError(result.status, "Goal not found");
  }

  return NextResponse.json(result.today);
}

export const GET = withApiErrorBoundary(getLanguageView);
