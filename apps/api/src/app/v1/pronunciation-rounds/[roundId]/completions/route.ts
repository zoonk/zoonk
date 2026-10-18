import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { languageError } from "@/lib/language-errors";
import { pronunciationRoundPathParamsSchema } from "@/lib/openapi/schemas/pronunciation";
import { parsePathParams } from "@/lib/path-params";
import { pronunciationRoundInputSchema } from "@zoonk/core/language/pronunciation/contract";
import { finishPronunciationRound } from "@zoonk/core/language/pronunciation/finish";
import { type NextRequest, NextResponse } from "next/server";

/** Counts a finished pronunciation round toward the learner's day, once. */
async function completePronunciationRound(
  request: NextRequest,
  context: RouteContext<"/v1/pronunciation-rounds/[roundId]/completions">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, pronunciationRoundInputSchema),
    context.params.then((params) =>
      parsePathParams({ params, schema: pronunciationRoundPathParamsSchema }),
    ),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await finishPronunciationRound({ input: body.data, roundId: path.data.roundId });

  if (result.status !== "ready") {
    return languageError(result.status, "Goal not found");
  }

  return NextResponse.json(result.result);
}

export const POST = withApiErrorBoundary(completePronunciationRound);
