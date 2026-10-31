import { getMeResponseData } from "@/app/v1/me/_utils/get-me-response";
import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { scheduleGooglePlayRenewalCheck } from "@/lib/google-play-renewal";
import { readBody } from "@/lib/request-input";
import { googlePlaySubscriptionRequestSchema } from "@zoonk/core/subscriptions/google-play-contract";
import { syncCurrentUserGooglePlaySubscription } from "@zoonk/core/subscriptions/google-play-sync";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, NextResponse } from "next/server";
import { getGooglePlaySubscriptionErrorResponse } from "./_utils/google-play-subscription-error";

async function createGooglePlaySubscription(request: NextRequest) {
  const parsed = await readBody(request, googlePlaySubscriptionRequestSchema);

  const { data: result, error } = await safeAsync(() =>
    syncCurrentUserGooglePlaySubscription({
      ...parsed,
      scheduleRenewalCheck: scheduleGooglePlayRenewalCheck,
    }),
  );

  if (error) {
    const response = getGooglePlaySubscriptionErrorResponse(error);

    if (response) {
      return response;
    }

    throw error;
  }

  const currentAccount = await getMeResponseData();

  if (!currentAccount) {
    return errors.unauthorized();
  }

  return NextResponse.json({ currentAccount, isActive: result.isActive });
}

export const POST = withApiErrorBoundary(createGooglePlaySubscription);
