export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : JSON.stringify(error));
}

export type SafeReturn<T> = { data: T; error: null } | { data: null; error: Error };

export async function safeAsync<T>(fn: () => Promise<T>): Promise<SafeReturn<T>> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (error) {
    return { data: null, error: toError(error) };
  }
}
