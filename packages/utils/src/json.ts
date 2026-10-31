export type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonObject | JsonValue[] | boolean | null | number | string;

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

export function getString(body: unknown, key: string): string | null {
  if (!isJsonObject(body) || !(key in body)) {
    return null;
  }

  const value = body[key];

  return typeof value === "string" ? value : null;
}

export function getNumber(body: unknown, key: string): number | null {
  if (!isJsonObject(body) || !(key in body)) {
    return null;
  }

  const value = body[key];

  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function stringifyUnknown(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    const json = JSON.stringify(value);

    return typeof json === "string" ? json : "";
  } catch {
    return "";
  }
}

export function mapJsonStrings(value: unknown, rewrite: (text: string) => string): unknown {
  if (typeof value === "string") {
    return rewrite(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => mapJsonStrings(entry, rewrite));
  }

  if (isJsonObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, mapJsonStrings(entry, rewrite)]),
    );
  }

  return value;
}
