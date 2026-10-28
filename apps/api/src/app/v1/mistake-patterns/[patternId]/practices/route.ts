import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { mistakePatternPathParamsSchema } from "@/lib/openapi/schemas/language";
import { readBody, readPathParams } from "@/lib/request-input";
import { mistakePatternPracticeInputSchema } from "@zoonk/core/language/patterns/contract";
import { practiceMistakePattern } from "@zoonk/core/language/patterns/practice";
import { type NextRequest, NextResponse } from "next/server";

async function practicePattern(
  request: NextRequest,
  context: RouteContext<"/v1/mistake-patterns/[patternId]/practices">,
) {
  const [body, path] = await Promise.all([
    readBody(request, mistakePatternPracticeInputSchema),
    readPathParams(context, mistakePatternPathParamsSchema),
  ]);

  const result = await practiceMistakePattern({ input: body, patternId: path.patternId });

  if (result.status !== "ready") {
    return languageError(result.status, "Pattern not found");
  }

  return NextResponse.json(result.result);
}

export const POST = withApiErrorBoundary(practicePattern);
