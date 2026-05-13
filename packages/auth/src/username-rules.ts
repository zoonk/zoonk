export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

const USERNAME_ALLOWED_CHARACTERS = /^[a-z0-9_]+$/u;

/**
 * Keeps every username entry point on the same canonical value before
 * validation or storage. Better Auth lowercases usernames by default, but it
 * does not trim direct API submissions unless we provide the normalizer here.
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Defines the URL-safe username shape that the UI has always promised:
 * lowercase letters, numbers, and underscores within the supported length
 * range. Callers may pass raw input because this function normalizes first.
 */
export function isUsernameSyntaxValid(username: string): boolean {
  const normalizedUsername = normalizeUsername(username);

  return (
    normalizedUsername.length >= USERNAME_MIN_LENGTH &&
    normalizedUsername.length <= USERNAME_MAX_LENGTH &&
    USERNAME_ALLOWED_CHARACTERS.test(normalizedUsername)
  );
}
