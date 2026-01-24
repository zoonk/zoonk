function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
