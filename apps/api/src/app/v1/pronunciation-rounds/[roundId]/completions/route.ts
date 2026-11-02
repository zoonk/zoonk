import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { pronunciationRoundPathParamsSchema } from "@/lib/openapi/schemas/pronunciation";
import { readBody, readPathParams } from "@/lib/request-input";
import { pronunciationRoundInputSchema } from "@zoonk/core/language/pronunciation/contract";
import { finishPronunciationRound } from "@zoonk/core/language/pronunciation/finish";
import { type NextRequest, NextResponse } from "next/server";

async function completePronunciationRound(
  request: NextRequest,
  context: RouteContext<"/v1/pronunciation-rounds/[roundId]/completions">,
) {
  const [body, path] = await Promise.all([
    readBody(request, pronunciationRoundInputSchema),
    readPathParams(context, pronunciationRoundPathParamsSchema),
  ]);

  const result = await finishPronunciationRound({ input: body, roundId: path.roundId });

  if (result.status !== "ready") {
    return languageError(result.status, "Goal not found");
  }

  return NextResponse.json(result.result);
}

export const POST = withApiErrorBoundary(completePronunciationRound);
