import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getNoticedPattern } from "@zoonk/core/language/patterns/noticed";
import { NextResponse } from "next/server";

async function getGoalMistakePattern(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/mistake-pattern">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getNoticedPattern({ goalId: path.goalId });

  if (result.status === "notLanguage" || result.status === "noGoal") {
    return NextResponse.json({ pattern: null });
  }

  if (result.status !== "ready") {
    return languageError(result.status, "Goal not found");
  }

  return NextResponse.json({ pattern: result.pattern });
}

export const GET = withApiErrorBoundary(getGoalMistakePattern);
