export function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeString(str: string): string {
  return removeAccents(str).toLowerCase().replace(/\s+/g, " ").trim();
}

export function toRegex(pattern: string): RegExp {
  // escape backslashes first
  let regex = pattern.replace(/\\/g, "\\\\");
  // escape dots
  regex = regex.replace(/\./g, "\\.");

  // replace "*\." (the escaped version of "*.") with "(.+\.)"
  // meaning: allow any subdomain(s)
  regex = regex.replace(/\*\\\./g, "(.+\\.)");

  // replace remaining "*" (e.g., "*-" patterns) with "(.+)"
  // meaning: allow any characters
  regex = regex.replace(/\*/g, "(.+)");

  // allow http/https wildcards exactly as provided
  return new RegExp(`^${regex}$`);
}
