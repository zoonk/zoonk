import { BLOCKED_USERNAMES } from "./blocked-usernames";

export function isUsernameAllowed(username: string): boolean {
  if (username.includes(".")) {
    return false;
  }
  return !BLOCKED_USERNAMES.has(username.toLowerCase());
}
