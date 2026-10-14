/** Chromium needs macOS services unavailable inside Codex's restricted sandbox. */
export function assertBrowserLaunchAllowed(): void {
  if (process.env.CODEX_SANDBOX && process.env.CODEX_SANDBOX !== "none") {
    throw new Error("Run browser tests outside the restricted sandbox before launching Chromium.");
  }
}
