/**
 * Read the Playwright base URL from the shared test environment.
 * Centralizing this lookup keeps browser tests and setup scripts aligned and
 * gives them the same failure message when the local web server is missing.
 */
export function getBaseURL(): string {
  const url = process.env.E2E_BASE_URL;

  if (!url) {
    throw new Error("E2E_BASE_URL not set. Is the webServer running?");
  }

  return url;
}
