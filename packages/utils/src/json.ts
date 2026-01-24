function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getString(body: unknown, key: string): string | null {
  if (!isJsonObject(body) || !(key in body)) {
    return null;
  }

  const value = body[key];

  return typeof value === "string" ? value : null;
}

export function getNumericString(body: unknown, key: string): string {
  if (!isJsonObject(body) || !(key in body)) {
    return "";
  }

  const value = body[key];

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return "";
}

export function getStringArray(body: unknown, key: string): string[] {
  if (!isJsonObject(body) || !(key in body)) {
    return [];
  }

  const value = body[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
