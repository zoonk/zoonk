import { errors } from "@/lib/api-errors";
import { getActiveSubscription } from "@zoonk/core/auth/subscription";
import { getCurrentUser } from "@zoonk/core/users/current";
import { getCurrentUserHasAppleAccount } from "@zoonk/core/users/has-apple-account";
import { NextResponse } from "next/server";
import { createMeResponse } from "./me-response";

/**
 * Combines independently reusable account resources while their shared private
 * session resolver joins repeated authentication calls.
 */
export async function getMeResponseData() {
  const [hasAppleAccount, subscription, user] = await Promise.all([
    getCurrentUserHasAppleAccount(),
    getActiveSubscription(),
    getCurrentUser(),
  ]);

  if (hasAppleAccount === null || !user) {
    return null;
  }

  return createMeResponse({ hasAppleAccount, subscription, user });
}

export async function getMeResponse() {
  const response = await getMeResponseData();

  if (!response) {
    return errors.unauthorized();
  }

  return NextResponse.json(response);
}
