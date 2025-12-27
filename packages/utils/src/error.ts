export const PERMISSION_ERROR_CODE = 403;

export class AppError<T extends string = string> extends Error {
  readonly code: T;

  constructor(code: T) {
    super(code);
    this.code = code;
    this.name = "AppError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toError(error: unknown): Error {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : JSON.stringify(error));
}

export type SafeReturn<T> =
  | { data: T; error: null }
  | { data: null; error: Error };

/**
 * Helper function to safely execute an async function and capture any errors.
 *
 * ### Example
 *
 * ```ts
 * const { data, error } = await safeAsync(async () => {
 *   // Your async code here
 * });
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
): Promise<SafeReturn<T>> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}
