import { safeAsync } from "@zoonk/utils/error";

/**
 * Preserves main's graceful presentation fallback without forcing other apps
 * that share the same core reads to hide infrastructure failures.
 */
export async function loadOptionalData<Result>(
  load: () => Promise<Result>,
): Promise<Result | null> {
  const { data } = await safeAsync(load);

  return data;
}
