type QueryParamValue = string | string[] | undefined;

/** Next.js gives repeated query keys as arrays; admin filters take the first. */
export function readQueryParam(value: QueryParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

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
