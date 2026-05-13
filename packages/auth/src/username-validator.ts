import { BLOCKED_USERNAMES } from "./blocked-usernames";
import { isUsernameSyntaxValid, normalizeUsername } from "./username-rules";

/**
 * Applies the full server-side username policy before Better Auth writes a
 * profile update. Syntax lives in `username-rules` so the client can share it
 * without bundling the reserved-name blocklist, while this function also
 * enforces names that must stay unavailable because they collide with routes,
 * infrastructure, or product terms.
 */
export function isUsernameAllowed(username: string): boolean {
  const normalizedUsername = normalizeUsername(username);

  if (!isUsernameSyntaxValid(normalizedUsername)) {
    return false;
  }

  return !BLOCKED_USERNAMES.has(normalizedUsername);
}
