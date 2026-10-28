import { withApiErrorBoundary } from "@/lib/api-handler";
import { withApiImageUrls } from "@/lib/file-urls";
import { learnerAccessError } from "@/lib/learner-errors";
import { readQueryParams } from "@/lib/request-input";
import { mistakePracticeInputSchema } from "@zoonk/core/mistakes/contract";
import { getMistakePractice } from "@zoonk/core/mistakes/practice";
import { NextResponse } from "next/server";

async function getPractice(request: Request) {
  const query = readQueryParams(request, mistakePracticeInputSchema);

  const result = await getMistakePractice(query);

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(
    withApiImageUrls({ practice: result.practice, trueFalseLabels: result.trueFalseLabels }),
  );
}

export const GET = withApiErrorBoundary(getPractice);
