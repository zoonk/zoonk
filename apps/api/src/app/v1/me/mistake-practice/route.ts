import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { parseQueryParams } from "@/lib/query-params";
import { mistakePracticeInputSchema } from "@zoonk/core/mistakes/contract";
import { getMistakePractice } from "@zoonk/core/mistakes/practice";
import { NextResponse } from "next/server";

/** Returns the mistakes to practice now, each with its targeted drill. */
async function getPractice(request: Request) {
  const query = parseQueryParams(new URL(request.url).searchParams, mistakePracticeInputSchema);

  if (!query.success) {
    return errors.validation(query.error);
  }

  const result = await getMistakePractice(query.data);

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json({ practice: result.practice, trueFalseLabels: result.trueFalseLabels });
}

export const GET = withApiErrorBoundary(getPractice);
