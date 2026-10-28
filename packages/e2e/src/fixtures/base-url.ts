export function getBaseURL(): string {
  const url = process.env.E2E_BASE_URL;

  if (!url) {
    throw new Error("E2E_BASE_URL not set. Is the webServer running?");
  }

  return url;
}
