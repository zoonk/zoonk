import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getTodayPattern } from "@zoonk/core/language/patterns/today";
import { NextResponse } from "next/server";

/**
 * The pattern the mistakes notebook offers for a goal, as main's notebook shows it: a language
 * goal's pattern noticed in recent mistakes, or none for every other goal.
 */
async function getGoalMistakePattern(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/mistake-pattern">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getTodayPattern({ goalId: path.goalId });

  if (result.status === "notLanguage" || result.status === "noGoal") {
    return NextResponse.json({ pattern: null });
  }

  if (result.status !== "ready") {
    return languageError(result.status, "Goal not found");
  }

  return NextResponse.json({ pattern: result.pattern });
}

export const GET = withApiErrorBoundary(getGoalMistakePattern);
