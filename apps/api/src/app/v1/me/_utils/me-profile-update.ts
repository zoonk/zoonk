import { errors, httpStatus } from "@/lib/api-errors";
import { getAuthError } from "@zoonk/auth/errors";

/**
 * Converts Better Auth update failures into the API app's standard error
 * envelope while preserving the status distinctions clients can act on.
 */
export function getProfileUpdateErrorResponse(error: unknown) {
  const authError = getAuthError(error);

  if (!authError) {
    return null;
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

  return null;
}
