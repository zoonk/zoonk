import { BLOCKED_USERNAMES } from "./blocked-usernames";

export function isUsernameAllowed(username: string): boolean {
  return !BLOCKED_USERNAMES.has(username.toLowerCase());
}
