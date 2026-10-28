const FIRST_PRINTABLE_ASCII = 32;
const ASCII_DELETE = 127;

/** Browsers normalize backslashes to slashes and strip tabs and newlines when resolving redirect URLs. */
export function getSafeAppRelativePath(
  nextPath: string | string[] | undefined | null,
): string | null {
  if (typeof nextPath !== "string") {
    return null;
  }

  if (
    !nextPath.startsWith("/") ||
    nextPath.startsWith("//") ||
    nextPath.includes("\\") ||
    nextPath.split("").some((character) => isAsciiControl(character))
  ) {
    return null;
  }

  return nextPath;
}

function isAsciiControl(character: string): boolean {
  const code = character.codePointAt(0) ?? FIRST_PRINTABLE_ASCII;
  return code < FIRST_PRINTABLE_ASCII || code === ASCII_DELETE;
}
