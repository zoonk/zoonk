import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import {
  languageUnitPathParamsSchema,
  languageUnitQuerySchema,
} from "@/lib/openapi/schemas/language";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { getLanguageUnitView } from "@zoonk/core/view-models/language/unit";
import { type NextRequest, NextResponse } from "next/server";

/**
 * A language unit's page: its "I can" checks and lessons, grammar tips, words, the learner's open
 * mistakes on it by skill, and the conversation to practice.
 */
async function getLanguageUnit(
  request: NextRequest,
  context: RouteContext<"/v1/language-units/[chapterId]">,
) {
  const path = await readPathParams(context, languageUnitPathParamsSchema);

  const query = readQueryParams(request, languageUnitQuerySchema);

  const result = await getLanguageUnitView({ chapterId: path.chapterId, goalId: query.goalId });

  if (result.status !== "ready") {
    return languageError(result.status, "Unit not found");
  }

  return NextResponse.json(result.unit);
}

export const GET = withApiErrorBoundary(getLanguageUnit);
