export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

export const USERNAME_ALLOWED_CHARACTERS = /^[a-z0-9_]+$/iu;

/** Better Auth lowercases usernames but doesn't trim direct API submissions without this normalizer. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isUsernameSyntaxValid(username: string): boolean {
  const normalizedUsername = normalizeUsername(username);

  return (
    normalizedUsername.length >= USERNAME_MIN_LENGTH &&
    normalizedUsername.length <= USERNAME_MAX_LENGTH &&
    USERNAME_ALLOWED_CHARACTERS.test(normalizedUsername)
  );
}

const USERNAME_FALLBACK = "learner";

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
