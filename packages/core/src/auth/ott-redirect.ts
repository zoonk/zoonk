/**
 * Accepts only app-relative paths that browsers cannot reinterpret as
 * network-path references. Backslashes are rejected because URL parsers
 * normalize them as slashes, so `/\evil.com` can become `//evil.com`.
 */
export function getSafeAppRelativePath(
  nextPath: string | string[] | undefined | null,
): string | null {
  if (typeof nextPath !== "string") {
    return null;
  }

  if (!nextPath.startsWith("/") || nextPath.startsWith("//") || nextPath.includes("\\")) {
    return null;
  }

  return nextPath;
}
