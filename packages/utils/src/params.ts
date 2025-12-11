export function safeParams(
  query: string | string[] | undefined,
): string | undefined {
  return Array.isArray(query) ? query[0] : query;
}
