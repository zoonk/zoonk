export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

export const USERNAME_ALLOWED_CHARACTERS = /^[a-z0-9_]+$/iu;

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

const USERNAME_FALLBACK = "learner";

/**
 * A starting username from the email's name part, so nobody has to pick one: "Ana.Souza+x@…"
 * becomes "ana_souza_x". A `suffix` (random digits, when that one is taken) goes after an
 * underscore, and the name part is shortened to keep the whole within the length limit.
 */
export function suggestUsername({ email, suffix }: { email: string; suffix?: string }): string {
  const namePart = (email.split("@")[0] ?? "")
    .normalize("NFD")
    .replaceAll(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9_]+/gu, "_")
    .replaceAll(/_+/gu, "_")
    .replaceAll(/^_|_$/gu, "");

  const base = namePart.length >= USERNAME_MIN_LENGTH ? namePart : USERNAME_FALLBACK;

  if (!suffix) {
    return base.slice(0, USERNAME_MAX_LENGTH);
  }

  const room = USERNAME_MAX_LENGTH - suffix.length - 1;
  return `${base.slice(0, room).replace(/_$/u, "")}_${suffix}`;
}
