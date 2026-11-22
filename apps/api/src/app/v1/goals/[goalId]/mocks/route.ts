import { httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError, writingExtraLimitErrorFields } from "@/lib/exam-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { anytimeMockInputSchema } from "@zoonk/core/exams/mocks/contract";
import { getMockOptions } from "@zoonk/core/exams/mocks/options";
import { startAnytimeMock } from "@zoonk/core/exams/mocks/start-anytime";
import { type NextRequest, NextResponse } from "next/server";

type MocksContext = RouteContext<"/v1/goals/[goalId]/mocks">;

const CREATED = 201;

async function listMocks(_request: Request, context: MocksContext) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getMockOptions({ goalId: path.goalId });

  if (result.status !== "ready") {
    return examError(result);
  }

  return NextResponse.json(result.view);
}

async function startMock(request: NextRequest, context: MocksContext) {
  const [body, path] = await Promise.all([
    readBody(request, anytimeMockInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await startAnytimeMock({ goalId: path.goalId, input: body });

  if (result.status === "preparing") {
    return NextResponse.json({ ...result, id: null });
  }

  if (result.status === "limitReached") {
    return NextResponse.json(
      { ...result, error: writingExtraLimitErrorFields(result.returnsOn) },
      { status: httpStatus.tooManyRequests },
    );
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
