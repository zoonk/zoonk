const DEDUPE_WINDOW_MS = 60_000;
const recentErrors = new Map<string, number>();

function getErrorKey(error: Error | unknown): string {
  if (error instanceof Error) {
    return `${error.name}:${error.message}`;
  }
  return String(error);
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

export function reportError(error: Error | unknown): void {
  if (!error) {
    return;
  }

  const key = getErrorKey(error);
  if (isDuplicate(key)) {
    return;
  }

  const payload = {
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : "Error",
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : undefined,
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  };

  fetch("/api/errors", {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => {
    // Silently fail - we don't want error reporting to cause more errors
  });
}
