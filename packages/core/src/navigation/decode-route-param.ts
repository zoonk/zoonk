/** Malformed percent sequences remain unchanged so invalid routes can return notFound instead of throwing. */
export function decodeRouteParam(param: string) {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}
