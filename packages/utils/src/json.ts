export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function toRecord(value: unknown): Record<string, unknown> {
  return isJsonObject(value) ? value : {};
}

export function getString(body: unknown, key: string): string | null {
  if (!isJsonObject(body) || !(key in body)) {
    return null;
  }

  const value = body[key];

  return typeof value === "string" ? value : null;
}
