import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { withApiImageUrls } from "@/lib/file-urls";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalChapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { chapterTestOutInputSchema } from "@zoonk/core/learner/test-out/contract";
import { getChapterTestOut } from "@zoonk/core/learner/test-out/get";
import { submitChapterTestOut } from "@zoonk/core/learner/test-out/submit";
import { type NextRequest, NextResponse } from "next/server";

type TestOutContext = RouteContext<"/v1/goals/[goalId]/chapters/[chapterId]/test-out">;

/** Returns the chapter's test-out questions. */
async function getTestOut(_request: Request, context: TestOutContext) {
  const path = parsePathParams({
    params: await context.params,
    schema: goalChapterPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getChapterTestOut(path.data);

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(withApiImageUrls(result.testOut));
}

/** Grades the test-out; passing tests out what the learner already knows. */
async function submitTestOut(request: NextRequest, context: TestOutContext) {
  const [body, path] = await Promise.all([
    parseBody(request, chapterTestOutInputSchema),
    context.params.then((params) =>
      parsePathParams({ params, schema: goalChapterPathParamsSchema }),
    ),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await submitChapterTestOut({ ...path.data, input: body.data });

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(result.outcome);
}

export const GET = withApiErrorBoundary(getTestOut);
export const POST = withApiErrorBoundary(submitTestOut);
