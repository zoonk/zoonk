import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { examError } from "@/lib/exam-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { anytimeMockInputSchema } from "@zoonk/core/exams/mocks/contract";
import { getMockOptions } from "@zoonk/core/exams/mocks/options";
import { startAnytimeMock } from "@zoonk/core/exams/mocks/start-anytime";
import { type NextRequest, NextResponse } from "next/server";

type MocksContext = RouteContext<"/v1/goals/[goalId]/mocks">;

const CREATED = 201;

/** The mocks the learner can take any time for an exam goal, with their size and time. */
async function listMocks(_request: Request, context: MocksContext) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getMockOptions({ goalId: path.data.goalId });

  if (result.status !== "ready") {
    return examError(result);
  }

  return NextResponse.json(result.view);
}

/** Starts one of the goal's mocks now, or the whole exam as placement in onboarding. */
async function startMock(request: NextRequest, context: MocksContext) {
  const [body, path] = await Promise.all([
    parseBody(request, anytimeMockInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: goalPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await startAnytimeMock({ goalId: path.data.goalId, input: body.data });

  if (result.status === "needsQuestions") {
    return NextResponse.json({ id: null, status: result.status });
  }

  if (!("id" in result)) {
    return examError(result);
  }

  return result.status === "started"
    ? NextResponse.json(
        { id: result.id, status: result.status },
        { headers: { Location: `/v1/mocks/${result.id}` }, status: CREATED },
      )
    : NextResponse.json({ id: result.id, status: result.status });
}

export const GET = withApiErrorBoundary(listMocks);
export const POST = withApiErrorBoundary(startMock);
