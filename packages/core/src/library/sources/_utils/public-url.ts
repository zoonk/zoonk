const BLOCKED_HOST_SUFFIXES = [".local", ".localhost", ".internal", ".test"];
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/u;

/** Only public web pages are fetched: never an address, a local name or credentials. */
function isPublicHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname.startsWith("[") || IPV4_PATTERN.test(hostname)) {
    return false;
  }

  return (
    hostname.includes(".") && !BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  );
}

/**
 * The one rule for every address research requests, including the ones a remote server hands
 * over (a redirect, a certificate's issuer), so none of them can point a request at a private
 * network.
 */
export function isPublicUrl(url: URL): boolean {
  return (
    (url.protocol === "https:" || url.protocol === "http:") &&
    !url.username &&
    !url.password &&
    isPublicHostname(url.hostname)
  );
}
