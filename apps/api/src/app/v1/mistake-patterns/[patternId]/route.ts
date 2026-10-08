import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { mistakePatternPathParamsSchema } from "@/lib/openapi/schemas/language";
import { parsePathParams } from "@/lib/path-params";
import { getMistakePattern } from "@zoonk/core/language/patterns/get";
import { NextResponse } from "next/server";

/** A pattern noticed in the learner's recent language mistakes, with its three-minute drill. */
async function getPattern(
  _request: Request,
  context: RouteContext<"/v1/mistake-patterns/[patternId]">,
) {
  const path = parsePathParams({
    params: await context.params,
    schema: mistakePatternPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getMistakePattern(path.data.patternId);

  if (result.status !== "ready") {
    return languageError(result.status, "Pattern not found");
  }

  return NextResponse.json(result.pattern);
}

export const GET = withApiErrorBoundary(getPattern);
