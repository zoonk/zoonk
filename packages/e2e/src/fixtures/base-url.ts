/** How many app servers the run starts (`E2E_SERVERS`, one by default). */
export function getServerCount(): number {
  return Number(process.env.E2E_SERVERS ?? 1);
}

/** The variable the Playwright config writes a server slot's address to. */
export function getBaseUrlVariable(slot: number): string {
  return slot === 0 ? "E2E_BASE_URL" : `E2E_BASE_URL_${slot}`;
}

/**
 * Read the Playwright base URL from the shared test environment: with several app servers
 * (`E2E_SERVERS`), the one for this worker's slot, so each worker keeps its own server.
 * Centralizing this lookup keeps browser tests and setup scripts aligned and
 * gives them the same failure message when the local web server is missing.
 */
export function getBaseURL(): string {
  const slot = Number(process.env.TEST_PARALLEL_INDEX ?? 0) % getServerCount();
  const url = process.env[getBaseUrlVariable(slot)];

  if (!url) {
    throw new Error("E2E_BASE_URL not set. Is the webServer running?");
  }

  return url;
}
