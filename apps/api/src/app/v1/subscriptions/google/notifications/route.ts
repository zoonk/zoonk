import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { googlePlayNotificationSchema } from "@zoonk/core/subscriptions/google-play-contract";
import { processGooglePlayNotification } from "@zoonk/core/subscriptions/google-play-notification";
import { safeAsync } from "@zoonk/utils/error";
import { API_URL } from "@zoonk/utils/url";
import { type NextRequest } from "next/server";
import { getGooglePlayNotificationErrorResponse } from "./_utils/google-play-notification-error";

/** The audience the Pub/Sub push subscription signs its tokens for: this endpoint's public URL. */
const PUSH_AUDIENCE = new URL("/v1/subscriptions/google/notifications", API_URL).href;

async function createGooglePlayNotification(request: NextRequest) {
  const { message } = await readBody(request, googlePlayNotificationSchema);

  const { error } = await safeAsync(() =>
    processGooglePlayNotification({
      audience: PUSH_AUDIENCE,
      authorization: request.headers.get("authorization"),
      message,
    }),
  );

  if (error) {
    const response = getGooglePlayNotificationErrorResponse(error);

    if (response) {
      return response;
    }

    throw error;
  }

  return new Response(null, { status: 204 });
}

export const POST = withApiErrorBoundary(createGooglePlayNotification);
