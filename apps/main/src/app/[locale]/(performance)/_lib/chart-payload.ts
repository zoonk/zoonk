export function isValidChartPayload<T>(payload: unknown): payload is { payload: T }[] {
  if (!Array.isArray(payload) || payload.length === 0) {
    return false;
  }

  const first = payload[0];

  return typeof first === "object" && first !== null && "payload" in first;
}
