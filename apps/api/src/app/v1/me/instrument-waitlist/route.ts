import { accessErrorCodes } from "@/lib/access-error-codes";
import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { instrumentWaitlistJoinSchema } from "@zoonk/core/instrument-waitlist/contract";
import { joinInstrumentWaitlist } from "@zoonk/core/instrument-waitlist/join";
import { listInstrumentWaitlist } from "@zoonk/core/instrument-waitlist/list";
import { type NextRequest, NextResponse } from "next/server";

/** The instruments the learner is waiting to learn to play. */
async function listEntries() {
  const entries = await listInstrumentWaitlist();

  if (!entries) {
    return errors.unauthorized();
  }

  return NextResponse.json({ entries });
}

/** Adds an instrument to the learner's waitlist; joining again returns the same entry. */
async function joinWaitlist(request: NextRequest) {
  const parsed = await parseBody(request, instrumentWaitlistJoinSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await joinInstrumentWaitlist(parsed.data);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "signInRequired") {
    return createErrorResponse({
      code: accessErrorCodes.accountRequired,
      message: "Create an account to join the waitlist",
      status: httpStatus.forbidden,
    });
  }

  return NextResponse.json({ entry: result.entry });
}

export const GET = withApiErrorBoundary(listEntries);
export const POST = withApiErrorBoundary(joinWaitlist);
