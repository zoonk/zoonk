import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getLanguageUnitsView } from "@zoonk/core/view-models/language/units";
import { NextResponse } from "next/server";

/** A language goal's units in teaching order, with what's done in each. */
async function getLanguageUnits(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/language-units">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getLanguageUnitsView({ goalId: path.goalId });

  if (result.status !== "ready") {
    return languageError(result.status, "Goal not found");
  }

  return NextResponse.json(result.units);
}

export const GET = withApiErrorBoundary(getLanguageUnits);
