/**
 * Fits the longest names sign-in providers send (Google takes 60-character first and last names)
 * and long full names such as Picasso's (122).
 */
export const NAME_MAX_LENGTH = 150;

export const NAME_TOO_LONG_ERROR_CODE = "NAME_TOO_LONG";

export function isNameTooLong(name: string) {
  // oxlint-disable-next-line typescript/no-misused-spread -- Counts code points, as Zod's `.max()` and OpenAPI's `maxLength` do.
  return [...name].length > NAME_MAX_LENGTH;
}

/** A name saved before the limit stays until the learner changes it. */
export function isNameChangeTooLong({ name, savedName }: { name: string; savedName: string }) {
  const trimmedName = name.trim();
  return trimmedName !== savedName.trim() && isNameTooLong(trimmedName);
}
