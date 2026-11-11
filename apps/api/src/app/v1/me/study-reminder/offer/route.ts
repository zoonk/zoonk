import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { claimStudyReminderOffer } from "@zoonk/core/reminders/claim-offer";
import { studyReminderOfferClaimSchema } from "@zoonk/core/reminders/contract";
import { type NextRequest, NextResponse } from "next/server";

async function claimOffer(request: NextRequest) {
  const input = await readBody(request, studyReminderOfferClaimSchema);
  const result = await claimStudyReminderOffer(input);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return NextResponse.json({ claimed: result.claimed });
}

export const POST = withApiErrorBoundary(claimOffer);
