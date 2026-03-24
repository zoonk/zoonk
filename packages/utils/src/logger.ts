function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === "test";
}

export function logError(...args: unknown[]): void {
  if (!isTestEnvironment()) {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
}

export function logInfo(...args: unknown[]): void {
  if (!isTestEnvironment()) {
    // eslint-disable-next-line no-console
    console.info(...args);
  }
}
