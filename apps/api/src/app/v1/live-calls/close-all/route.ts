import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { liveCallCloseAllResponseSchema } from "@zoonk/core/language/conversations/admission-contract";
import { closeAllLiveCalls } from "@zoonk/core/language/conversations/close-all";
import { NextResponse } from "next/server";

/** Core authorizes the admin and disables admission before attempting the bounded close batch. */
async function closeAll() {
  const result = await closeAllLiveCalls();

  if (result.status !== "ready") {
    return result.status === "unauthorized" ? errors.unauthorized() : errors.forbidden();
  }

  return NextResponse.json(liveCallCloseAllResponseSchema.parse(result), {
    headers: { "Cache-Control": "no-store" },
  });
}

export const POST = withApiErrorBoundary(closeAll);
