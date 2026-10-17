type QueryParamValue = string | string[] | undefined;

/**
 * Next.js gives repeated query keys as arrays. Admin filters support one value
 * per key, so the first value is the canonical input.
 */
export function readQueryParam(value: QueryParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Enum filters come from hand-editable URLs, so only a known value reaches
 * Prisma. Anything else means "no filter".
 */
export function readEnumQueryParam<Value extends string>({
  allowed,
  value,
}: {
  allowed: readonly Value[];
  value: QueryParamValue;
}): Value | undefined {
  const first = readQueryParam(value);
  return allowed.find((option) => option === first);
}
