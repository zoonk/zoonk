import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { appleSubscriptionNotificationSchema } from "@zoonk/core/subscriptions/apple-contract";
import { processAppleSubscriptionNotification } from "@zoonk/core/subscriptions/apple-notification";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest } from "next/server";
import { getAppleNotificationErrorResponse } from "./_utils/apple-notification-error";

async function createAppleSubscriptionNotification(request: NextRequest) {
  const parsed = await parseBody(request, appleSubscriptionNotificationSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { error } = await safeAsync(() => processAppleSubscriptionNotification(parsed.data));

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
