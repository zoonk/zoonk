import { toRegex } from "./string";

function handleWildcardOrigins(origins: string[]): (string | RegExp)[] {
  return origins.map((origin) => {
    if (origin.includes("*")) {
      return toRegex(origin);
    }

    return origin;
  });
}

export function isOriginAllowed(
  origin: string,
  allowedOrigins: string[],
): boolean {
  const handledOrigins = handleWildcardOrigins(allowedOrigins);

  return handledOrigins.some((allowedOrigin) => {
    if (typeof allowedOrigin === "string") {
      return allowedOrigin.toLowerCase() === origin.toLowerCase();
    }

    return allowedOrigin.test(origin.toLowerCase());
  });
}
