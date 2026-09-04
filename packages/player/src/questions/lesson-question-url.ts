const SAFE_ABSOLUTE_PROTOCOLS = new Set(["http:", "https:"]);
const SAFE_RELATIVE_PREFIXES = ["/", "./", "../", "#", "?"] as const;
const STREAMDOWN_INCOMPLETE_LINK = "streamdown:incomplete-link";

function isSafeRelativeUrl(url: string): boolean {
  return SAFE_RELATIVE_PREFIXES.some((prefix) => url.startsWith(prefix));
}

/** AI output is untrusted, so generated links are limited to browser-safe web destinations. */
export function getSafeLessonQuestionUrl(url: string): string | null {
  if (url === STREAMDOWN_INCOMPLETE_LINK || isSafeRelativeUrl(url)) {
    return url;
  }

  try {
    return SAFE_ABSOLUTE_PROTOCOLS.has(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}
