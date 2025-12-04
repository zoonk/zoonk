function checkPattern(pattern: string, origin: string): boolean {
  const lowerPattern = pattern.toLowerCase();
  const lowerOrigin = origin.toLowerCase();
  const isWildcard = pattern.includes("*");

  if (!isWildcard) {
    return lowerOrigin === lowerPattern;
  }

  // Reject patterns with multiple wildcards
  if (lowerPattern.split("*").length > 2) {
    return false;
  }

  // Parse the origin URL to extract hostname for matching
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(lowerOrigin);
  } catch {
    return false;
  }

  const [prefix, suffix] = lowerPattern.split("*");

  // Determine what we're matching against based on pattern format
  // If pattern has protocol (e.g., "https://*.domain.com"), match full origin
  // If pattern is hostname-only (e.g., "*-team.vercel.app"), match only hostname
  const hasProtocol = prefix.includes("://");
  const matchTarget = hasProtocol
    ? `${parsedOrigin.protocol}//${parsedOrigin.host}`
    : parsedOrigin.host;

  if (prefix && !matchTarget.startsWith(prefix)) {
    return false;
  }

  if (suffix && !matchTarget.endsWith(suffix)) {
    return false;
  }

  return true;
}

export function isAllowedOrigin(origin: string, allowed: string[]) {
  return allowed.some((pattern) => checkPattern(pattern, origin));
}
