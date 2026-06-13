const POSTHOG_DEFAULTS = "2026-05-30" as const;

type PostHogConfig = { defaults: typeof POSTHOG_DEFAULTS; host: string; projectToken: string };

/**
 * Reads shared browser PostHog settings from public environment variables so
 * every app initializes the SDK with the same project contract and defaults.
 */
export function getPostHogConfig(): PostHogConfig | null {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

  if (!host || !projectToken) {
    return null;
  }

  return { defaults: POSTHOG_DEFAULTS, host, projectToken };
}
