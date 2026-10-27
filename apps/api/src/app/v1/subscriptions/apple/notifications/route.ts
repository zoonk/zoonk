import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { appleSubscriptionNotificationSchema } from "@zoonk/core/subscriptions/apple-contract";
import { processAppleSubscriptionNotification } from "@zoonk/core/subscriptions/apple-notification";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest } from "next/server";
import { getAppleNotificationErrorResponse } from "./_utils/apple-notification-error";

async function createAppleSubscriptionNotification(request: NextRequest) {
  const parsed = await readBody(request, appleSubscriptionNotificationSchema);

  const { error } = await safeAsync(() => processAppleSubscriptionNotification(parsed));

  if (error) {
    const response = getAppleNotificationErrorResponse(error);

    if (response) {
      return response;
    }

    throw error;
  }

  return new Response(null, { status: 204 });
}

export const POST = withApiErrorBoundary(createAppleSubscriptionNotification);
