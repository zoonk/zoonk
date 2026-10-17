import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { languageError } from "@/lib/language-errors";
import { mistakePatternPathParamsSchema } from "@/lib/openapi/schemas/language";
import { parsePathParams } from "@/lib/path-params";
import { mistakePatternPracticeInputSchema } from "@zoonk/core/language/patterns/contract";
import { practiceMistakePattern } from "@zoonk/core/language/patterns/practice";
import { type NextRequest, NextResponse } from "next/server";

/** Finishes a pattern's drill: checks the answers, pays Brain Power and counts toward today. */
async function practicePattern(
  request: NextRequest,
  context: RouteContext<"/v1/mistake-patterns/[patternId]/practices">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, mistakePatternPracticeInputSchema),
    context.params.then((params) =>
      parsePathParams({ params, schema: mistakePatternPathParamsSchema }),
    ),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await practiceMistakePattern({ input: body.data, patternId: path.data.patternId });

  if (result.status !== "ready") {
    return languageError(result.status, "Pattern not found");
  }

  return NextResponse.json(result.result);
}

export const POST = withApiErrorBoundary(practicePattern);
