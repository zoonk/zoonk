import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { dismissGuardianInvite } from "@zoonk/core/minors/guardian/dismiss-invite";
import { NextResponse } from "next/server";

/** "Not now" to inviting a guardian: Today's `guardianInvite` stays false from then on. */
async function dismissInvite() {
  const result = await dismissGuardianInvite();

  if (result.status !== "dismissed") {
    return errors.unauthorized();
  }

  return new NextResponse(null, { status: 204 });
}

export const POST = withApiErrorBoundary(dismissInvite);
