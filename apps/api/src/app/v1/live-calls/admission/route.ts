import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { serializeLiveCallAdmission } from "@/lib/live-call-admin-responses";
import {
  getLiveCallAdmission,
  updateLiveCallAdmission,
} from "@zoonk/core/language/conversations/admission";
import { liveCallAdmissionInputSchema } from "@zoonk/core/language/conversations/admission-contract";
import { type NextRequest, NextResponse } from "next/server";

/** Admin reads use API's provider configuration; checking key presence never starts a session. */
async function readAdmission() {
  const result = await getLiveCallAdmission();

  if (result.status !== "ready") {
    return result.status === "unauthorized" ? errors.unauthorized() : errors.forbidden();
  }

  return NextResponse.json(serializeLiveCallAdmission(result), {
    headers: { "Cache-Control": "no-store" },
  });
}

async function updateAdmission(request: NextRequest) {
  const body = await parseBody(request, liveCallAdmissionInputSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await updateLiveCallAdmission(body.data);

  if (result.status !== "ready") {
    if (result.status === "invalid") {
      return errors.unprocessableEntity();
    }

    return result.status === "unauthorized" ? errors.unauthorized() : errors.forbidden();
  }

  return NextResponse.json(
    liveCallAdmissionInputSchema.parse({
      admission: result.setting.admission,
      freeDailyBudgetMicros: result.setting.freeDailyBudgetMicros,
    }),
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = withApiErrorBoundary(readAdmission);
export const POST = withApiErrorBoundary(updateAdmission);
