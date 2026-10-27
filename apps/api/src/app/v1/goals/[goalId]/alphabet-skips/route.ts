import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { skipAlphabetIntro } from "@zoonk/core/language/alphabet/skip";
import { NextResponse } from "next/server";

/** The learner already reads the script, so their sessions stop opening with the alphabet. */
async function skipAlphabet(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/alphabet-skips">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await skipAlphabetIntro(path.goalId);

  if (result.status !== "skipped") {
    return languageError(result.status, "Goal not found");
  }

  return new NextResponse(null, { status: 204 });
}

export const POST = withApiErrorBoundary(skipAlphabet);
