import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { settleRunActivity } from "@/workflows/_shared/run-activity";
import { getLessonContentHookToken } from "@/workflows/lessons/lesson-content-result";
import { readLiveLessonWaitingState } from "@zoonk/core/lookahead/lesson-waiting-state";
import { safeAsync } from "@zoonk/utils/error";
import { NextResponse } from "next/server";
import { getHookByToken } from "workflow/api";
import { HookNotFoundError } from "workflow/errors";

async function observeRun(runId: string) {
  const status = await settleRunActivity(runId);
  return status === "alive" ? { runId, status } : { status };
}

async function observeWriter({ lessonId, runId }: { lessonId: string; runId: string | null }) {
  if (runId) {
    return observeRun(runId);
  }

  const { data: hook, error } = await safeAsync(() =>
    getHookByToken(getLessonContentHookToken(lessonId)),
  );

  if (error) {
    return { status: HookNotFoundError.is(error) ? "ended" : "unknown" } as const;
  }

  return observeRun(hook.runId);
}

async function getLessonReadiness(
  _request: Request,
  context: RouteContext<"/v1/library/lessons/[lessonId]/readiness">,
) {
  const path = await readPathParams(context, lessonPathParamsSchema);
  const result = await readLiveLessonWaitingState({ lessonId: path.lessonId, observeWriter });

  if (result.status === "unknown" || result.status === "ended") {
    return errors.serviceUnavailable();
  }

  if (result.status !== "ready") {
    return accessError(result.status);
  }

  return NextResponse.json(result.state, { headers: { "Cache-Control": "no-store" } });
}

export const GET = withApiErrorBoundary(getLessonReadiness);
