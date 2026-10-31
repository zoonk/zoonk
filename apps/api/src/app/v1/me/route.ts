import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { type MeDeletionInput, meDeletionSchema, meUpdateSchema } from "@/lib/openapi/schemas/me";
import { readBody } from "@/lib/request-input";
import { getActiveSubscription } from "@zoonk/core/auth/subscription";
import { updateCurrentUser } from "@zoonk/core/users/current";
import { deleteCurrentUser } from "@zoonk/core/users/delete-current";
import { getCurrentUserHasAppleAccount } from "@zoonk/core/users/has-apple-account";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, NextResponse } from "next/server";
import { getMeResponse } from "./_utils/get-me-response";
import { getAccountDeletionErrorResponse } from "./_utils/me-account-deletion";
import { getProfileUpdateErrorResponse } from "./_utils/me-profile-update";
import { createMeResponse } from "./_utils/me-response";

async function getCurrentUserAccount() {
  return getMeResponse();
}

async function updateCurrentUserAccount(request: NextRequest) {
  const parsed = await readBody(request, meUpdateSchema);

  const { data: result, error } = await safeAsync(() => updateCurrentUser({ input: parsed }));

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

/** Narrows each variant so core's compile-time credential guard still holds. */
function deleteValidatedCurrentUser(credentials: MeDeletionInput) {
  if ("appleCredentials" in credentials) {
    return deleteCurrentUser({ appleCredentials: credentials.appleCredentials });
  }

  if ("emailCredentials" in credentials) {
    return deleteCurrentUser({ emailCredentials: credentials.emailCredentials });
  }

  return deleteCurrentUser({});
}

async function deleteCurrentUserAccount(request: NextRequest) {
  const parsed = await readBody(request, meDeletionSchema);

  const { data: result, error } = await safeAsync(() => deleteValidatedCurrentUser(parsed));

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
