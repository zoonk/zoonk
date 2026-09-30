import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import {
  languageUnitPathParamsSchema,
  languageUnitQuerySchema,
} from "@/lib/openapi/schemas/language";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
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
  const path = parsePathParams({
    params: await context.params,
    schema: languageUnitPathParamsSchema,
  });

  const query = parseQueryParams(request.nextUrl.searchParams, languageUnitQuerySchema);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!query.success) {
    return errors.validation(query.error);
  }

  const result = await getLanguageUnitView({
    chapterId: path.data.chapterId,
    goalId: query.data.goalId,
  });

  if (result.status !== "ready") {
    return languageError(result.status, "Unit not found");
  }

  return NextResponse.json(result.unit);
}

export const GET = withApiErrorBoundary(getLanguageUnit);
