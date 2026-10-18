import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { instrumentWaitlistEntryPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { leaveInstrumentWaitlist } from "@zoonk/core/instrument-waitlist/leave";
import { type NextRequest, NextResponse } from "next/server";

type EntryContext = RouteContext<"/v1/me/instrument-waitlist/[entryId]">;

/** Takes one instrument off the learner's waitlist. */
async function leaveWaitlist(_request: NextRequest, context: EntryContext) {
  const path = parsePathParams({
    params: await context.params,
    schema: instrumentWaitlistEntryPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await leaveInstrumentWaitlist(path.data.entryId);

  if (result.status !== "left") {
    return result.status === "unauthorized" ? errors.unauthorized() : errors.notFound();
  }

  return new NextResponse(null, { status: 204 });
}

export const DELETE = withApiErrorBoundary(leaveWaitlist);
