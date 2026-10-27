import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { withApiImageUrls } from "@/lib/file-urls";
import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getMock } from "@zoonk/core/exams/mocks/get";
import { NextResponse } from "next/server";

/** Returns a mock exam: its conditions, the running section without answers, or its result. */
async function getMockRoute(_request: Request, context: RouteContext<"/v1/mocks/[blockId]">) {
  const path = await readPathParams(context, mockPathParamsSchema);

  const result = await getMock(path.blockId);

  if (result.status !== "ready") {
    return examError(result);
  }

  return NextResponse.json(withApiImageUrls(result.mock));
}

export const GET = withApiErrorBoundary(getMockRoute);
