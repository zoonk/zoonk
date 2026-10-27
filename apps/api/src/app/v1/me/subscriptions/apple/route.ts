import { getMeResponseData } from "@/app/v1/me/_utils/get-me-response";
import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { appleSubscriptionRequestSchema } from "@zoonk/core/subscriptions/apple-contract";
import { syncCurrentUserAppleSubscription } from "@zoonk/core/subscriptions/apple-sync";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, NextResponse } from "next/server";
import { getAppleSubscriptionErrorResponse } from "./_utils/apple-subscription-error";

async function createAppleSubscription(request: NextRequest) {
  const parsed = await readBody(request, appleSubscriptionRequestSchema);

  const { data: result, error } = await safeAsync(() => syncCurrentUserAppleSubscription(parsed));

  if (error) {
    const response = getAppleSubscriptionErrorResponse(error);

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

export const POST = withApiErrorBoundary(createAppleSubscription);
