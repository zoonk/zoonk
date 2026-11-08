export function pickKeys<TValue>(
  record: Record<string, TValue>,
  keys: readonly string[],
): Record<string, TValue> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => keys.includes(key)));
}

export function omitKeys<TValue>(
  record: Record<string, TValue>,
  keys: readonly string[],
): Record<string, TValue> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)));
}
