function checkPattern(pattern: string, origin: string): boolean {
  const lowerPattern = pattern.toLowerCase();
  const lowerOrigin = origin.toLowerCase();
  const isWildcard = pattern.includes("*");

  if (!isWildcard) {
    return lowerOrigin === lowerPattern;
  }

  const [prefix, suffix] = lowerPattern.split("*");

  if (prefix && !lowerOrigin.startsWith(prefix)) {
    return false;
  }

  if (suffix && !lowerOrigin.endsWith(suffix)) {
    return false;
  }

  return true;
}

export function isAllowedOrigin(origin: string, allowed: string[]) {
  return allowed.some((pattern) => checkPattern(pattern, origin));
}
