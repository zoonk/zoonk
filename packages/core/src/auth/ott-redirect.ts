const FIRST_PRINTABLE_ASCII = 32;
const ASCII_DELETE = 127;

/**
 * Accepts only app-relative paths that browsers cannot reinterpret as
 * network-path references. Backslashes are rejected because URL parsers
 * normalize them as slashes, so `/\evil.com` can become `//evil.com`. ASCII controls are rejected
 * because browsers strip tabs and newlines before resolving a Location header.
 */
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
