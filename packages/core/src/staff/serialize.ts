export function serializeStaffValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("base64");
  }

  if (Array.isArray(value)) {
    return value.map((entry: unknown) => serializeStaffValue(entry));
  }

  if (value && typeof value === "object") {
    if (hasJsonValue(value)) {
      return serializeStaffValue(value.toJSON());
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serializeStaffValue(entry)]),
    );
  }

  return value;
}

function hasJsonValue(value: object): value is { toJSON: () => unknown } {
  return "toJSON" in value && typeof value.toJSON === "function";
}
