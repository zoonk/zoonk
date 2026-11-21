import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { mockWritingQuerySchema } from "@/lib/openapi/schemas/mocks";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { isRunActive } from "@/workflows/_shared/run-activity";
import { getMockPaperToken } from "@/workflows/goals/mock-paper-progress";
import { getMockPaperWriting } from "@zoonk/core/exams/mocks/paper-writing";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, NextResponse } from "next/server";
import { getHookByToken } from "workflow/api";

async function findPaperWriter(token: string): Promise<string | null> {
  const { data: hook } = await safeAsync(() => getHookByToken(token));
  return hook && (await isRunActive(hook.runId)) ? hook.runId : null;
}

async function readMockWriting(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/mock-writing">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);
  const query = readQueryParams(request, mockWritingQuerySchema);

  const result = await getMockPaperWriting({ goalId: path.goalId, planItemId: query.planItemId });

  if (result.status !== "ready") {
    return accessError(result.status);
  }

  const { goalId, owed, paper } = result;
  const namespace = paper ? getMockPaperToken({ goalId, paper }) : null;
  const writer = namespace ? await findPaperWriter(namespace) : null;

  if (writer) {
    return NextResponse.json({ generationId: writer, namespace, status: "writing" });
  }

  return NextResponse.json({
    generationId: null,
    namespace: null,
    status: owed ? "starting" : "none",
  });
}

export const GET = withApiErrorBoundary(readMockWriting);
