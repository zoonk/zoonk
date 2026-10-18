import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getLanguageProgressView } from "@zoonk/core/view-models/language/progress";
import { NextResponse } from "next/server";

/** Returns a language goal's Progress: levels by skill since the level test, "I can" checks and the last four weeks. */
async function getLanguageView(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/language-progress">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getLanguageProgressView({ goalId: path.data.goalId });

  if (result.status !== "ready") {
    return languageError(result.status, "Goal not found");
  }

  return NextResponse.json(result.progress);
}

export const GET = withApiErrorBoundary(getLanguageView);
