import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { type MeDeletionInput, meDeletionSchema, meUpdateSchema } from "@/lib/openapi/schemas/me";
import { getActiveSubscription } from "@zoonk/core/auth/subscription";
import { getCurrentUser, updateCurrentUser } from "@zoonk/core/users/current";
import { deleteCurrentUser } from "@zoonk/core/users/delete-current";
import { getCurrentUserHasAppleAccount } from "@zoonk/core/users/has-apple-account";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, NextResponse } from "next/server";
import { getAccountDeletionErrorResponse } from "./_utils/me-account-deletion";
import { getProfileUpdateErrorResponse } from "./_utils/me-profile-update";
import { createMeResponse } from "./_utils/me-response";

/**
 * Combines independently reusable account resources while their shared private
 * session resolver joins repeated authentication calls.
 */
async function getMeResponse() {
  const [hasAppleAccount, subscription, user] = await Promise.all([
    getCurrentUserHasAppleAccount(),
    getActiveSubscription(),
    getCurrentUser(),
  ]);

  if (hasAppleAccount === null || !user) {
    return errors.unauthorized();
  }

  return NextResponse.json(createMeResponse({ hasAppleAccount, subscription, user }));
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

  const [hasAppleAccount, subscription] = await Promise.all([
    getCurrentUserHasAppleAccount(),
    getActiveSubscription(),
  ]);

  if (hasAppleAccount === null) {
    return errors.unauthorized();
  }

  return NextResponse.json(createMeResponse({ hasAppleAccount, subscription, user: result }));
}

/**
 * Converts the validated mutually exclusive request variant into the matching
 * core capability input without weakening its compile-time credential guard.
 */
function deleteValidatedCurrentUser(credentials: MeDeletionInput) {
  if ("appleCredentials" in credentials) {
    return deleteCurrentUser({ appleCredentials: credentials.appleCredentials });
  }

  if ("emailCredentials" in credentials) {
    return deleteCurrentUser({ emailCredentials: credentials.emailCredentials });
  }

  return deleteCurrentUser({});
}

/**
 * Permanently removes the signed-in user's account after Better Auth verifies
 * that the bearer or cookie session is authoritative and recent enough.
 */
async function deleteCurrentUserAccount(request: NextRequest) {
  const parsed = await parseBody(request, meDeletionSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { data: result, error } = await safeAsync(() => deleteValidatedCurrentUser(parsed.data));

  if (error) {
    const response = getAccountDeletionErrorResponse(error);

    if (response) {
      return response;
    }

    throw error;
  }

  return NextResponse.json(result);
}

export const DELETE = withApiErrorBoundary(deleteCurrentUserAccount);
export const GET = withApiErrorBoundary(getCurrentUserAccount);
export const PATCH = withApiErrorBoundary(updateCurrentUserAccount);
