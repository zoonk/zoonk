import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { mistakePracticeFinishInputSchema } from "@zoonk/core/mistakes/contract";
import { finishMistakePractice } from "@zoonk/core/mistakes/practice-finish";
import { type NextRequest, NextResponse } from "next/server";

async function createMistakePracticeCompletion(request: NextRequest) {
  const body = await readBody(request, mistakePracticeFinishInputSchema);

  const result = await finishMistakePractice(body);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  if (result.status === "invalid") {
    return errors.unprocessableEntity("These answers aren't this learner's mistake practice");
  }

  return NextResponse.json(result.result);
}

export const POST = withApiErrorBoundary(createMistakePracticeCompletion);
