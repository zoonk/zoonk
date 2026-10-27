import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { mistakePatternPathParamsSchema } from "@/lib/openapi/schemas/language";
import { readPathParams } from "@/lib/request-input";
import { dismissMistakePattern } from "@zoonk/core/language/patterns/dismiss";
import { NextResponse } from "next/server";

/** Takes a pattern off Today without practicing it, such as a note that it was only typos. */
async function dismissPattern(
  _request: Request,
  context: RouteContext<"/v1/mistake-patterns/[patternId]/dismissals">,
) {
  const path = await readPathParams(context, mistakePatternPathParamsSchema);

  const result = await dismissMistakePattern(path.patternId);

  if (result.status !== "dismissed") {
    return languageError(result.status, "Pattern not found");
  }

  return new NextResponse(null, { status: 204 });
}

export const POST = withApiErrorBoundary(dismissPattern);
