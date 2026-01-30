const DEDUPE_WINDOW_MS = 60_000;
const recentErrors = new Map<string, number>();

function errorToString(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "number" || typeof error === "boolean") {
    return String(error);
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "[Unknown error]";
  }
}

function getErrorKey(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}:${error.message}`;
  }
  return errorToString(error);
}

function isDuplicate(key: string): boolean {
  const lastReported = recentErrors.get(key);
  const now = Date.now();

  if (lastReported && now - lastReported < DEDUPE_WINDOW_MS) {
    return true;
  }

  recentErrors.set(key, now);
  return false;
}

export function reportError(error: unknown): void {
  if (!error) {
    return;
  }

  const key = getErrorKey(error);
  if (isDuplicate(key)) {
    return;
  }

  const payload = {
    message: errorToString(error),
    name: error instanceof Error ? error.name : "Error",
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    url: globalThis.window === undefined ? undefined : globalThis.location.href,
    userAgent: typeof navigator === "undefined" ? undefined : navigator.userAgent,
  };

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.zoonk.com";

  fetch(`${apiBaseUrl}/v1/errors`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => {
    // Silently fail - we don't want error reporting to cause more errors
  });
}
