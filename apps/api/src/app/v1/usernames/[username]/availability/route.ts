import { errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { usernameAvailabilityPathSchema } from "@/lib/openapi/schemas/usernames";
import { parsePathParams } from "@/lib/path-params";
import { getAuthError } from "@zoonk/auth/errors";
import { getUsernameAvailability } from "@zoonk/core/users/current";
import { safeAsync } from "@zoonk/utils/error";
import { NextResponse } from "next/server";

/**
 * Returns Better Auth's canonical reserved-name and uniqueness result through
 * the stable public product contract used by profile clients.
 */
async function getUsernameAvailabilityRoute(
  _request: Request,
  context: RouteContext<"/v1/usernames/[username]/availability">,
) {
  const parsed = parsePathParams({
    params: await context.params,
    schema: usernameAvailabilityPathSchema,
  });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { data, error } = await safeAsync(() => getUsernameAvailability(parsed.data.username));

  if (!error && data) {
    return NextResponse.json(data);
  }

  const authError = getAuthError(error);

  if (authError?.statusCode === httpStatus.unprocessableEntity) {
    return NextResponse.json({ isAvailable: false, username: parsed.data.username });
  }

  throw error ?? new Error("Username availability returned no result");
}

export const GET = withApiErrorBoundary(getUsernameAvailabilityRoute);
