import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getSpeakingPaper } from "@zoonk/core/language/exam-speaking/paper";
import { NextResponse } from "next/server";

async function getSpeakingPaperRoute(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/speaking-paper">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getSpeakingPaper({ goalId: path.goalId });

  if (result.status !== "ready") {
    return languageError(result.status, "Goal not found");
  }

  if (!result.paper) {
    return languageError("notFound", "Speaking practice not found");
  }

  return NextResponse.json(result.paper);
}

export const GET = withApiErrorBoundary(getSpeakingPaperRoute);
