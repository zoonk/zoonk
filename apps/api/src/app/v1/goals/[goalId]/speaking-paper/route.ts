import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getSpeakingPaper } from "@zoonk/core/language/exam-speaking/paper";
import { NextResponse } from "next/server";

/** A language goal's speaking practice: its exam's speaking tasks and the learner's last tries. */
async function getSpeakingPaperRoute(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/speaking-paper">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getSpeakingPaper({ goalId: path.goalId });

  if (result.status !== "ready") {
    return languageError(result.status, "Goal not found");
  }

  // No exam's speaking format fits the goal's language and level.
  if (!result.paper) {
    return languageError("notFound", "Speaking practice not found");
  }

  return NextResponse.json(result.paper);
}

export const GET = withApiErrorBoundary(getSpeakingPaperRoute);
