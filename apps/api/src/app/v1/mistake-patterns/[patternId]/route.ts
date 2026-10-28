import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { mistakePatternPathParamsSchema } from "@/lib/openapi/schemas/language";
import { readPathParams } from "@/lib/request-input";
import { getMistakePattern } from "@zoonk/core/language/patterns/get";
import { NextResponse } from "next/server";

async function getPattern(
  _request: Request,
  context: RouteContext<"/v1/mistake-patterns/[patternId]">,
) {
  const path = await readPathParams(context, mistakePatternPathParamsSchema);

  const result = await getMistakePattern(path.patternId);

  if (result.status !== "ready") {
    return languageError(result.status, "Pattern not found");
  }

  return NextResponse.json(result.pattern);
}

export const GET = withApiErrorBoundary(getPattern);
