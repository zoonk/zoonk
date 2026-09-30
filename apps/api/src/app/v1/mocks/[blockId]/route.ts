import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getMock } from "@zoonk/core/exams/mocks/get";
import { NextResponse } from "next/server";

/** Returns a mock exam: its conditions, the running section without answers, or its result. */
async function getMockRoute(_request: Request, context: RouteContext<"/v1/mocks/[blockId]">) {
  const path = parsePathParams({ params: await context.params, schema: mockPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getMock(path.data.blockId);

  if (result.status !== "ready") {
    return examError(result);
  }

  return NextResponse.json(result.mock);
}

export const GET = withApiErrorBoundary(getMockRoute);
