import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getLanguageUnitsView } from "@zoonk/core/view-models/language/units";
import { NextResponse } from "next/server";

/** A language goal's units in teaching order, with what's done in each. */
async function getLanguageUnits(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/language-units">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getLanguageUnitsView({ goalId: path.data.goalId });

  if (result.status !== "ready") {
    return languageError(result.status, "Goal not found");
  }

  return NextResponse.json(result.units);
}

export const GET = withApiErrorBoundary(getLanguageUnits);
