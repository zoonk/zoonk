import { errors, httpStatus } from "@/lib/api-errors";
import { getBetterAuthError } from "@/lib/better-auth-errors";
import { type meUpdateSchema } from "@/lib/openapi/schemas/me";
import { type z } from "zod";

type ProfileUpdate = z.infer<typeof meUpdateSchema>;
type UserUpdateBody = { name?: string; username?: string };

/**
 * Mirrors the main app's profile update behavior by always applying name
 * changes while skipping a username write when the submitted username is
 * already the current one.
 */
export function getUserUpdateBody({
  currentUsername,
  profile,
}: {
  currentUsername?: string | null;
  profile: ProfileUpdate;
}): UserUpdateBody {
  return {
    ...(profile.name !== undefined && { name: profile.name }),
    ...(profile.username !== undefined &&
      profile.username !== currentUsername && { username: profile.username }),
  };
}

/**
 * Detects idempotent profile updates, such as submitting the current username,
 * so the route can return the current account document without asking Better
 * Auth to update an empty body.
 */
export function hasUserUpdateBody(body: UserUpdateBody): boolean {
  return Object.keys(body).length > 0;
}

/**
 * Converts Better Auth update failures into the API app's standard error
 * envelope while preserving the status distinctions clients can act on.
 */
export function getProfileUpdateErrorResponse(error: unknown) {
  const authError = getBetterAuthError(error);

  if (!authError) {
    return errors.internal("Unable to update profile");
  }

  if (authError.statusCode === httpStatus.unauthorized) {
    return errors.unauthorized();
  }

  if (authError.code === "USERNAME_IS_ALREADY_TAKEN") {
    return errors.conflict("Username is already taken");
  }

  if (
    authError.statusCode === httpStatus.badRequest ||
    authError.statusCode === httpStatus.unprocessableEntity
  ) {
    return errors.badRequest(authError.message);
  }

  return errors.internal("Unable to update profile");
}
