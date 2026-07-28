import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { meUpdateSchema } from "@/lib/openapi/schemas/me";
import { getActiveSubscription } from "@zoonk/core/auth/subscription";
import { getCurrentUser, updateCurrentUser } from "@zoonk/core/users/current";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, NextResponse } from "next/server";
import { getProfileUpdateErrorResponse } from "./_utils/me-profile-update";
import { createMeResponse } from "./_utils/me-response";

/**
 * Combines independently reusable account resources while their shared private
 * session resolver joins repeated authentication calls.
 */
async function getMeResponse() {
  const [subscription, user] = await Promise.all([getActiveSubscription(), getCurrentUser()]);

  if (!user) {
    return errors.unauthorized();
  }

  return NextResponse.json(createMeResponse({ subscription, user }));
}

/**
 * Exposes the signed-in user's profile and account state to native clients.
 */
async function getCurrentUserAccount() {
  return getMeResponse();
}

/**
 * Updates the signed-in user's public profile using the same Better Auth path
 * as the main app, including username validation and uniqueness checks.
 */
async function updateCurrentUserAccount(request: NextRequest) {
  const parsed = await parseBody(request, meUpdateSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { data: result, error } = await safeAsync(() => updateCurrentUser({ input: parsed.data }));

  if (error) {
    const response = getProfileUpdateErrorResponse(error);

    if (response) {
      return response;
    }

    throw error;
  }

  if (!result) {
    return errors.unauthorized();
  }

  const subscription = await getActiveSubscription();
  return NextResponse.json(createMeResponse({ subscription, user: result }));
}

export const GET = withApiErrorBoundary(getCurrentUserAccount);
export const PATCH = withApiErrorBoundary(updateCurrentUserAccount);
