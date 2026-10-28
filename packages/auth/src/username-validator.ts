import { BLOCKED_USERNAMES } from "./blocked-usernames";
import { isUsernameSyntaxValid, normalizeUsername } from "./username-rules";

export function isUsernameAllowed(username: string): boolean {
  const normalizedUsername = normalizeUsername(username);

  if (!isUsernameSyntaxValid(normalizedUsername)) {
    return false;
  }

  return !BLOCKED_USERNAMES.has(normalizedUsername);
}
