/**
 * Tests can exercise real server routes or integration code, so every side
 * effect that leaves the process (provider requests, analytics) shares one
 * definition of "running under tests" and stays off there.
 */
export function isTestEnvironment(): boolean {
  return (
    process.env.E2E_TESTING === "true" ||
    process.env.NODE_ENV === "test" ||
    process.env.VITEST === "true"
  );
}
