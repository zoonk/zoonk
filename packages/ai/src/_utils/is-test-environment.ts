export function isTestEnvironment(): boolean {
  return (
    process.env.E2E_TESTING === "true" ||
    process.env.NODE_ENV === "test" ||
    process.env.VITEST === "true"
  );
}
