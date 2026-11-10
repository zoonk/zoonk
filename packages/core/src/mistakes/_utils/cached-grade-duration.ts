import { isJsonObject } from "@zoonk/utils/json";

export function cachedGradeDuration({
  fallback,
  result,
}: {
  fallback: number;
  result: unknown;
}): number {
  const duration = isJsonObject(result) ? result.durationMs : undefined;
  return typeof duration === "number" ? duration : fallback;
}
