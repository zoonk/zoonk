import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { withApiImageUrls } from "@/lib/file-urls";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { focusTestInputSchema } from "@zoonk/core/plans/focus-test/contract";
import { getFocusTest } from "@zoonk/core/plans/focus-test/get";
import { submitFocusTest } from "@zoonk/core/plans/focus-test/submit";
import { type NextRequest, NextResponse } from "next/server";

type FocusTestContext = RouteContext<"/v1/goals/[goalId]/plan/focus-test">;

/** A plan with fewer than two areas has no focus to choose. */
const UNAVAILABLE_MESSAGE = "This plan has no areas to choose a focus between";

/** Returns the goal's focus test questions. */
async function getTest(_request: Request, context: FocusTestContext) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getFocusTest(path);

  if (result.status === "unavailable") {
    return errors.notFound(UNAVAILABLE_MESSAGE);
  }

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(withApiImageUrls(result.focusTest));
}

/** Grades the focus test and focuses the plan where the answers show it's needed most. */
async function submitTest(request: NextRequest, context: FocusTestContext) {
  const [body, path] = await Promise.all([
    readBody(request, focusTestInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await submitFocusTest({ ...path, input: body });

  if (result.status === "unavailable") {
    return errors.notFound(UNAVAILABLE_MESSAGE);
  }

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(result.outcome);
}

export const GET = withApiErrorBoundary(getTest);
export const POST = withApiErrorBoundary(submitTest);
